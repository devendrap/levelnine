import * as repo from './repository'
import * as containerRepo from '../containers/repository'
import { query as dbQuery } from '../../db/index'
import type {
  ContainerManifest,
  ExplorationRun,
  ExplorationStep,
  DimensionConfig,
  StepName,
  GateDecision,
  ManifestSnapshot,
} from '../../core/types/index'
import { getClient, getModel, type Provider } from '../../../src/api/providers'
import { buildPrompt, parseExplorationOutput } from './prompts'
import { transaction } from '../../db/index'

export class ExplorationError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'ExplorationError'
  }
}

const STEP_ORDER: StepName[] = ['generate', 'self_review', 'gaps', 'gate']

async function getOriginalUserPrompt(containerId: string): Promise<string> {
  const result = await dbQuery<{ content: string }>(
    `SELECT content FROM chat_messages WHERE container_id = $1 AND role = 'user' ORDER BY created_at ASC LIMIT 1`,
    [containerId],
  )
  return result.rows[0]?.content ?? ''
}

// ============================================================================
// Start Exploration
// ============================================================================

export async function startExploration(containerId: string): Promise<ExplorationRun> {
  const container = await containerRepo.findContainerById(containerId)
  if (!container) throw new ExplorationError('Container not found', 404)
  if (container.status === 'locked' || container.status === 'launched') {
    throw new ExplorationError('Cannot explore a locked/launched container', 403)
  }

  // Check for existing active run
  const existing = await repo.findActiveRun(containerId)
  if (existing) throw new ExplorationError('An exploration run is already active', 409)

  const dimensions = await repo.findAllDimensions()
  if (dimensions.length === 0) throw new ExplorationError('No dimensions configured', 500)

  const run = await repo.insertRun({ container_id: containerId })

  // Set first dimension
  await repo.updateRun(run.id, {
    current_dimension: dimensions[0].dimension,
    current_step: 'generate',
  })

  return (await repo.findRunById(run.id))!
}

// ============================================================================
// Execute Next Step
// ============================================================================

export async function executeNextStep(
  runId: string,
  provider: Provider = 'ollama',
  model?: string,
  onChunk?: (chunk: string) => void,
): Promise<{ step: ExplorationStep; isGate: boolean; isDone: boolean }> {
  const run = await repo.findRunById(runId)
  if (!run) throw new ExplorationError('Run not found', 404)
  if (run.status !== 'active') throw new ExplorationError('Run is not active', 400)

  const container = await containerRepo.findContainerById(run.container_id)
  if (!container) throw new ExplorationError('Container not found', 404)

  const dimensions = await repo.findAllDimensions()
  const currentDim = dimensions.find(d => d.dimension === run.current_dimension)
  if (!currentDim) throw new ExplorationError('Current dimension not found', 500)

  const currentStep = run.current_step ?? 'generate'

  // Create step record
  const step = await repo.insertStep({
    run_id: run.id,
    dimension: currentDim.dimension,
    step: currentStep,
  })

  // Mark as running
  await repo.updateStep(step.id, { status: 'running' })

  // Build prompt
  const manifest = (container.manifest ?? {}) as ContainerManifest
  const completedSteps = await repo.findStepsByRun(run.id)
  const completedDimensions = getCompletedDimensions(completedSteps, dimensions)

  // Fetch user's original prompt for domain context
  const userPrompt = await getOriginalUserPrompt(run.container_id)

  const context: Record<string, any> = {
    allDimensions: dimensions.map(d => d.label),
    completedDimensions: completedDimensions.map(d => d.label),
    userPrompt,
  }

  // For self_review, include previous generate output
  if (currentStep === 'self_review') {
    const genStep = completedSteps.find(s => s.dimension === currentDim.dimension && s.step === 'generate' && s.status === 'completed')
    context.previousOutput = genStep?.llm_output ?? ''
  }

  // For gate, build step summaries
  if (currentStep === 'gate') {
    const dimSteps = completedSteps.filter(s => s.dimension === currentDim.dimension && s.status === 'completed')
    context.stepSummaries = dimSteps.map(s => `### ${s.step}\n${s.llm_output ?? '(no output)'}`).join('\n\n')
  }

  const prompt = buildPrompt(currentStep, currentDim, container.name, manifest, context)

  // Call LLM
  try {
    const { client } = getClient(provider)
    const modelId = getModel(provider, model)

    let fullOutput = ''

    const response = await client.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: `You are an expert industry analyst performing a structured exploration of the "${container.name}" domain.${userPrompt ? ` The user specifically requested: "${userPrompt}". Align all entity types, terminology, and structure to this domain context.` : ''} Be thorough, specific, and use real industry terminology.` },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      stream: !!onChunk,
    })

    if (onChunk && Symbol.asyncIterator in (response as any)) {
      for await (const chunk of response as any) {
        const text = chunk.choices?.[0]?.delta?.content ?? ''
        if (text) {
          fullOutput += text
          onChunk(text)
        }
      }
    } else {
      fullOutput = (response as any).choices[0]?.message?.content?.trim() ?? ''
    }

    // Parse structured output
    const parsed = parseExplorationOutput(fullOutput)

    const stepUpdate: Record<string, any> = {
      status: 'completed',
      llm_output: fullOutput,
    }

    if (parsed) {
      if (parsed.entity_types_added) stepUpdate.entity_types_added = parsed.entity_types_added
      if (parsed.entity_types_modified) stepUpdate.entity_types_modified = parsed.entity_types_modified
      if (parsed.relations_added) stepUpdate.relations_added = parsed.relations_added
      if (parsed.relations_modified) stepUpdate.relations_modified = parsed.relations_modified
      if (parsed.explore_opportunities) stepUpdate.explore_opportunities = parsed.explore_opportunities
      if (parsed.out_of_scope_items) stepUpdate.out_of_scope_items = parsed.out_of_scope_items

      // Merge into manifest (for generate and self_review steps)
      if (currentStep === 'generate' || currentStep === 'self_review') {
        await mergeIntoManifest(container.id, currentDim.dimension, parsed, manifest)
      }

      // Consolidation: also merge during gaps step (removals may come from gap analysis)
      if (currentStep === 'gaps' && currentDim.dimension === 'consolidation' && parsed) {
        await mergeIntoManifest(container.id, currentDim.dimension, parsed, manifest)
      }
    }

    const updatedStep = await repo.updateStep(step.id, stepUpdate)

    // Advance to next step (unless it's a gate — wait for admin decision)
    const isGate = currentStep === 'gate'
    if (!isGate) {
      const nextStepIdx = STEP_ORDER.indexOf(currentStep) + 1
      if (nextStepIdx < STEP_ORDER.length) {
        await repo.updateRun(run.id, { current_step: STEP_ORDER[nextStepIdx] })
      }
    }

    return { step: updatedStep!, isGate, isDone: false }
  } catch (err: any) {
    await repo.updateStep(step.id, { status: 'error', llm_output: err.message })
    throw new ExplorationError(`LLM error: ${err.message}`, 502)
  }
}

// ============================================================================
// Cross-Dimension Validation (Step 8)
// ============================================================================

export interface ValidationWarning {
  type: 'phantom_type' | 'missing_workflow_target' | 'dangling_relation' | 'missing_document_target' | 'missing_report_source' | 'orphan_type'
  message: string
  source: string
  referenced_type: string
}

export function validateManifestCrossReferences(manifest: ContainerManifest): ValidationWarning[] {
  const warnings: ValidationWarning[] = []
  const typeNames = new Set((manifest.entity_types ?? []).map(et => et.name))

  // Validate role restricted_entity_types reference real types
  for (const role of manifest.roles ?? []) {
    for (const restriction of role.restricted_entity_types ?? []) {
      const typeName = typeof restriction === 'string' ? restriction : restriction.type
      if (!typeNames.has(typeName)) {
        warnings.push({
          type: 'phantom_type',
          message: `Role "${role.name}" restricts access to non-existent type "${typeName}"`,
          source: `roles.${role.name}`,
          referenced_type: typeName,
        })
      }
    }
  }

  // Validate workflow entity_type references exist
  for (const wf of manifest.workflows ?? []) {
    if (!typeNames.has(wf.entity_type)) {
      warnings.push({
        type: 'missing_workflow_target',
        message: `Workflow "${wf.name}" targets non-existent type "${wf.entity_type}"`,
        source: `workflows.${wf.name}`,
        referenced_type: wf.entity_type,
      })
    }
  }

  // Validate relation source/target types exist
  for (const rel of manifest.relations ?? []) {
    if (!typeNames.has(rel.source_type)) {
      warnings.push({
        type: 'dangling_relation',
        message: `Relation "${rel.source_type} → ${rel.target_type}" references non-existent source type "${rel.source_type}"`,
        source: `relations`,
        referenced_type: rel.source_type,
      })
    }
    if (!typeNames.has(rel.target_type)) {
      warnings.push({
        type: 'dangling_relation',
        message: `Relation "${rel.source_type} → ${rel.target_type}" references non-existent target type "${rel.target_type}"`,
        source: `relations`,
        referenced_type: rel.target_type,
      })
    }
  }

  // Validate document entity_type references exist
  for (const doc of manifest.documents ?? []) {
    if (doc.entity_type && !typeNames.has(doc.entity_type)) {
      warnings.push({
        type: 'missing_document_target',
        message: `Document "${doc.name}" references non-existent type "${doc.entity_type}"`,
        source: `documents.${doc.name}`,
        referenced_type: doc.entity_type,
      })
    }
  }

  // Validate report entity_types references exist
  for (const report of manifest.reports ?? []) {
    for (const et of report.entity_types ?? []) {
      if (!typeNames.has(et)) {
        warnings.push({
          type: 'missing_report_source',
          message: `Report "${report.name}" references non-existent data source type "${et}"`,
          source: `reports.${report.name}`,
          referenced_type: et,
        })
      }
    }
  }

  // Validate compliance entity_types references exist
  for (const c of manifest.compliance ?? []) {
    for (const et of c.entity_types ?? []) {
      if (!typeNames.has(et)) {
        warnings.push({
          type: 'phantom_type',
          message: `Compliance "${c.name}" references non-existent type "${et}"`,
          source: `compliance.${c.name}`,
          referenced_type: et,
        })
      }
    }
  }

  // Validate integration entity_types references exist
  for (const i of manifest.integrations ?? []) {
    for (const et of i.entity_types ?? []) {
      if (!typeNames.has(et)) {
        warnings.push({
          type: 'phantom_type',
          message: `Integration "${i.name}" references non-existent type "${et}"`,
          source: `integrations.${i.name}`,
          referenced_type: et,
        })
      }
    }
  }

  // Validate notification trigger_entity_type references exist
  for (const n of manifest.notifications ?? []) {
    if (n.trigger_entity_type && !typeNames.has(n.trigger_entity_type)) {
      warnings.push({
        type: 'phantom_type',
        message: `Notification "${n.name}" triggers on non-existent type "${n.trigger_entity_type}"`,
        source: `notifications.${n.name}`,
        referenced_type: n.trigger_entity_type,
      })
    }
  }

  // Validate ui_config entity_type references exist
  for (const u of manifest.ui_configs ?? []) {
    if (u.entity_type && !typeNames.has(u.entity_type)) {
      warnings.push({
        type: 'phantom_type',
        message: `UI config "${u.name}" targets non-existent type "${u.entity_type}"`,
        source: `ui_configs.${u.name}`,
        referenced_type: u.entity_type,
      })
    }
  }

  // Detect orphan types — entity types with zero relations, documents, reports, or workflows referencing them
  const referencedTypes = new Set<string>()
  for (const r of manifest.relations ?? []) {
    referencedTypes.add(r.source_type)
    referencedTypes.add(r.target_type)
  }
  for (const d of manifest.documents ?? []) {
    if (d.entity_type) referencedTypes.add(d.entity_type)
  }
  for (const r of manifest.reports ?? []) {
    for (const et of r.entity_types ?? []) referencedTypes.add(et)
  }
  for (const wf of manifest.workflows ?? []) {
    referencedTypes.add(wf.entity_type)
  }
  for (const c of manifest.compliance ?? []) {
    for (const et of c.entity_types ?? []) referencedTypes.add(et)
  }
  for (const n of manifest.notifications ?? []) {
    if (n.trigger_entity_type) referencedTypes.add(n.trigger_entity_type)
  }
  for (const u of manifest.ui_configs ?? []) {
    if (u.entity_type) referencedTypes.add(u.entity_type)
  }

  for (const typeName of typeNames) {
    if (!referencedTypes.has(typeName)) {
      warnings.push({
        type: 'orphan_type',
        message: `Entity type "${typeName}" has no relations, workflows, documents, or reports referencing it`,
        source: `entity_types.${typeName}`,
        referenced_type: typeName,
      })
    }
  }

  return warnings
}

// ============================================================================
// Gate Decision
// ============================================================================

export async function submitGateDecision(
  stepId: string,
  decision: GateDecision,
  notes?: string,
): Promise<{ run: ExplorationRun; isDone: boolean; warnings?: ValidationWarning[] }> {
  const step = await repo.findStepById(stepId)
  if (!step) throw new ExplorationError('Step not found', 404)
  if (step.step !== 'gate') throw new ExplorationError('Not a gate step', 400)

  const run = await repo.findRunById(step.run_id)
  if (!run) throw new ExplorationError('Run not found', 404)

  // Save gate decision
  await repo.updateStep(stepId, { gate_decision: decision, gate_notes: notes })

  // Take manifest snapshot
  const container = await containerRepo.findContainerById(run.container_id)
  if (container) {
    await repo.insertSnapshot({
      container_id: run.container_id,
      run_id: run.id,
      dimension: step.dimension,
      manifest: container.manifest as ContainerManifest,
    })
  }

  // Cross-dimension validation — report phantom types and dangling references
  const manifest = (container?.manifest ?? {}) as ContainerManifest
  const warnings = validateManifestCrossReferences(manifest)

  const dimensions = await repo.findAllDimensions()
  const currentIdx = dimensions.findIndex(d => d.dimension === step.dimension)

  if (decision === 'stop') {
    if (container) {
      await materializeDimension(run.container_id, step.dimension, manifest)
    }
    await repo.updateRun(run.id, { status: 'paused', current_step: null })
    return { run: (await repo.findRunById(run.id))!, isDone: true, warnings }
  }

  if (decision === 'go_deeper') {
    await repo.updateRun(run.id, { current_step: 'generate' })
    return { run: (await repo.findRunById(run.id))!, isDone: false, warnings }
  }

  if (decision === 'skip' || decision === 'continue') {
    if (container) {
      await materializeDimension(run.container_id, step.dimension, manifest)
    }

    const nextIdx = currentIdx + 1
    if (nextIdx < dimensions.length) {
      await repo.updateRun(run.id, {
        current_dimension: dimensions[nextIdx].dimension,
        current_step: 'generate',
      })
      return { run: (await repo.findRunById(run.id))!, isDone: false, warnings }
    } else {
      if (run.phase === 'first_pass') {
        await repo.updateRun(run.id, {
          phase: 'holistic_review',
          current_dimension: null,
          current_step: null,
          status: 'completed',
        })
        return { run: (await repo.findRunById(run.id))!, isDone: true, warnings }
      }
      await repo.updateRun(run.id, { status: 'completed', current_step: null })
      return { run: (await repo.findRunById(run.id))!, isDone: true, warnings }
    }
  }

  return { run: (await repo.findRunById(run.id))!, isDone: false, warnings }
}

// ============================================================================
// Progress
// ============================================================================

export async function getProgress(containerId: string): Promise<{
  run: ExplorationRun | null
  dimensions: DimensionConfig[]
  steps: ExplorationStep[]
  completedDimensions: string[]
  currentDimension: DimensionConfig | null
  currentStep: StepName | null
}> {
  const run = await repo.findActiveRun(containerId)
  const dimensions = await repo.findAllDimensions()

  if (!run) {
    // Check for most recent completed run
    const runs = await repo.findRunsByContainer(containerId)
    const latest = runs[0] ?? null
    if (latest) {
      const steps = await repo.findStepsByRun(latest.id)
      const completed = getCompletedDimensions(steps, dimensions)
      return {
        run: latest,
        dimensions,
        steps,
        completedDimensions: completed.map(d => d.dimension),
        currentDimension: null,
        currentStep: null,
      }
    }
    return { run: null, dimensions, steps: [], completedDimensions: [], currentDimension: null, currentStep: null }
  }

  const steps = await repo.findStepsByRun(run.id)
  const completed = getCompletedDimensions(steps, dimensions)
  const currentDim = dimensions.find(d => d.dimension === run.current_dimension) ?? null

  return {
    run,
    dimensions,
    steps,
    completedDimensions: completed.map(d => d.dimension),
    currentDimension: currentDim,
    currentStep: run.current_step,
  }
}

export async function getSnapshots(containerId: string): Promise<ManifestSnapshot[]> {
  return repo.findSnapshotsByContainer(containerId)
}

// ============================================================================
// Helpers
// ============================================================================

function getCompletedDimensions(steps: ExplorationStep[], dimensions: DimensionConfig[]): DimensionConfig[] {
  const completedDims = new Set<string>()
  for (const step of steps) {
    if (step.step === 'gate' && step.status === 'completed' && step.gate_decision) {
      completedDims.add(step.dimension)
    }
  }
  return dimensions.filter(d => completedDims.has(d.dimension))
}

async function mergeIntoManifest(
  containerId: string,
  dimension: string,
  parsed: Record<string, any>,
  currentManifest: ContainerManifest,
): Promise<void> {
  const manifest = { ...currentManifest }
  manifest.entity_types = [...(manifest.entity_types ?? [])]
  manifest.relations = [...(manifest.relations ?? [])]
  manifest.roles = [...(manifest.roles ?? [])]
  manifest.workflows = [...(manifest.workflows ?? [])]
  manifest.compliance = [...(manifest.compliance ?? [])]
  manifest.documents = [...(manifest.documents ?? [])]
  manifest.integrations = [...(manifest.integrations ?? [])]
  manifest.reports = [...(manifest.reports ?? [])]
  manifest.edge_cases = [...(manifest.edge_cases ?? [])]
  manifest.scope = [...(manifest.scope ?? [])]
  manifest.out_of_scope = [...(manifest.out_of_scope ?? [])]

  // Build name indexes for O(1) dedup lookups
  const etNames = new Set(manifest.entity_types.map(e => e.name))
  const relKeys = new Set(manifest.relations.map(r => `${r.source_type}|${r.target_type}|${r.relation_type}`))
  const nameIndex = (arr: Array<{ name: string }>) => new Set(arr.map(x => x.name))
  const roleNames = nameIndex(manifest.roles)
  const wfNames = nameIndex(manifest.workflows)
  const compNames = nameIndex(manifest.compliance)
  const docNames = nameIndex(manifest.documents)
  const intNames = nameIndex(manifest.integrations)
  const repNames = nameIndex(manifest.reports)
  const ecNames = nameIndex(manifest.edge_cases)

  // Consolidation: remove entity types
  if (parsed.entity_types_removed?.length) {
    const removedNames = new Set(parsed.entity_types_removed.map((r: any) => r.name))
    manifest.entity_types = manifest.entity_types.filter(et => !removedNames.has(et.name))
    for (const name of removedNames) etNames.delete(name)
    manifest.relations = manifest.relations.filter(
      r => !removedNames.has(r.source_type) && !removedNames.has(r.target_type),
    )
  }

  // Add new entity types
  if (parsed.entity_types_added?.length) {
    for (const et of parsed.entity_types_added) {
      if (!etNames.has(et.name)) {
        etNames.add(et.name)
        manifest.entity_types.push({
          name: et.name,
          description: et.description,
          schema: null,
          key_fields: et.key_fields,
          source_dimension: dimension,
        })
      }
    }
  }

  // Modify existing entity types
  if (parsed.entity_types_modified?.length) {
    const etByName = new Map(manifest.entity_types.map(e => [e.name, e]))
    for (const mod of parsed.entity_types_modified) {
      const existing = etByName.get(mod.name)
      if (existing && !existing.reviewed) {
        if (mod.changes.description) existing.description = mod.changes.description
        if (mod.changes.key_fields) existing.key_fields = mod.changes.key_fields
      }
    }
  }

  // Add relations
  if (parsed.relations_added?.length) {
    for (const rel of parsed.relations_added) {
      const key = `${rel.source_type}|${rel.target_type}|${rel.relation_type}`
      if (!relKeys.has(key)) {
        relKeys.add(key)
        manifest.relations.push({ ...rel, source_dimension: dimension })
      }
    }
  }

  // Helper: add items with dedup by name
  const addByName = (
    target: any[], names: Set<string>, items: any[] | undefined, dim: string,
  ) => {
    if (!items?.length) return
    for (const item of items) {
      if (!names.has(item.name)) {
        names.add(item.name)
        target.push({ ...item, source_dimension: dim })
      }
    }
  }

  addByName(manifest.roles, roleNames, parsed.roles_added, dimension)
  addByName(manifest.workflows, wfNames, parsed.workflows_added, dimension)
  addByName(manifest.compliance, compNames, parsed.compliance_added, dimension)
  addByName(manifest.documents, docNames, parsed.documents_added, dimension)
  addByName(manifest.integrations, intNames, parsed.integrations_added, dimension)
  addByName(manifest.reports, repNames, parsed.reports_added, dimension)
  addByName(manifest.edge_cases, ecNames, parsed.edge_cases_added, dimension)

  // D9: Notifications
  manifest.notifications = [...(manifest.notifications ?? [])]
  if (parsed.notifications_added?.length) {
    const notifNames = nameIndex(manifest.notifications)
    addByName(manifest.notifications, notifNames, parsed.notifications_added, dimension)
  }

  // D10: UI configs
  manifest.ui_configs = [...(manifest.ui_configs ?? [])]
  if (parsed.ui_configs_added?.length) {
    const uiNames = nameIndex(manifest.ui_configs)
    addByName(manifest.ui_configs, uiNames, parsed.ui_configs_added, dimension)
  }

  // D11: Pages
  manifest.pages = [...(manifest.pages ?? [])]
  if (parsed.pages_added?.length) {
    const pageNames = nameIndex(manifest.pages)
    for (const p of parsed.pages_added) {
      if (!pageNames.has(p.name)) {
        pageNames.add(p.name)
        manifest.pages.push({ ...p, source_dimension: dimension } as any)
      }
    }
  }

  // D11: Seed data
  if (parsed.seed_data?.length) {
    manifest.seed_data = [...(manifest.seed_data ?? [])]
    const seedByType = new Map(manifest.seed_data.map(s => [s.entity_type, s]))
    for (const s of parsed.seed_data) {
      const existing = seedByType.get(s.entity_type)
      if (existing) {
        existing.records = [...existing.records, ...s.records]
      } else {
        manifest.seed_data.push(s)
        seedByType.set(s.entity_type, s)
      }
    }
  }

  // Scope items
  if (parsed.scope_items?.length) {
    for (const item of parsed.scope_items) {
      if (!manifest.scope.includes(item)) manifest.scope.push(item)
    }
  }

  // Out of scope
  if (parsed.out_of_scope_items?.length) {
    for (const item of parsed.out_of_scope_items) {
      if (!manifest.out_of_scope.includes(item.item)) manifest.out_of_scope.push(item.item)
    }
  }

  await containerRepo.updateContainer(containerId, { manifest })
}

// ============================================================================
// Materialize — promote manifest artifacts for a dimension into DB rows
// Called on gate approval (continue/skip), not at lock time
// ============================================================================

async function materializeDimension(
  containerId: string,
  dimension: string,
  manifest: ContainerManifest,
): Promise<void> {
  await transaction(async (client) => {
    // Consolidation: remove entity types that were merged/absorbed
    if (dimension === 'consolidation') {
      // Find entity types that existed before but are no longer in manifest (they were removed during consolidation)
      const existingTypes = await client.query(
        'SELECT name FROM entity_types WHERE container_id = $1',
        [containerId],
      )
      const manifestTypeNames = new Set((manifest.entity_types ?? []).map(et => et.name))
      for (const row of existingTypes.rows) {
        if (!manifestTypeNames.has(row.name)) {
          await client.query(
            'DELETE FROM entity_types WHERE container_id = $1 AND name = $2',
            [containerId, row.name],
          )
          // Also clean up relations referencing removed types
          await client.query(
            'DELETE FROM cfg_relations WHERE container_id = $1 AND (source_type = $2 OR target_type = $2)',
            [containerId, row.name],
          )
        }
      }
    }

    // Entity types — insert/upsert those from this dimension
    const dimEntityTypes = (manifest.entity_types ?? []).filter(et => et.source_dimension === dimension)
    for (const et of dimEntityTypes) {
      await client.query(
        `INSERT INTO entity_types (name, description, schema, data_schema, field_metadata, related_types, document_slots, report_relevance, container_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (name, COALESCE(container_id, '00000000-0000-0000-0000-000000000000')) DO UPDATE SET
           description = EXCLUDED.description, schema = EXCLUDED.schema,
           data_schema = EXCLUDED.data_schema, field_metadata = EXCLUDED.field_metadata,
           related_types = EXCLUDED.related_types, document_slots = EXCLUDED.document_slots,
           report_relevance = EXCLUDED.report_relevance, updated_at = NOW()`,
        [
          et.name, et.description,
          et.schema ? JSON.stringify(et.schema) : null,
          et.data_schema ? JSON.stringify(et.data_schema) : null,
          et.field_metadata ? JSON.stringify(et.field_metadata) : null,
          et.related_types ? JSON.stringify(et.related_types) : null,
          et.document_slots ? JSON.stringify(et.document_slots) : null,
          et.report_relevance ? JSON.stringify(et.report_relevance) : null,
          containerId,
        ],
      )
    }

    // Relations
    const dimRelations = (manifest.relations ?? []).filter(r => r.source_dimension === dimension)
    for (const rel of dimRelations) {
      await client.query(
        `INSERT INTO cfg_relations (container_id, source_type, target_type, relation_type, description, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (container_id, source_type, target_type, relation_type) DO UPDATE SET
           description = EXCLUDED.description`,
        [containerId, rel.source_type, rel.target_type, rel.relation_type, rel.description ?? null, dimension],
      )
    }

    // Roles
    const dimRoles = (manifest.roles ?? []).filter(r => r.source_dimension === dimension)
    for (const role of dimRoles) {
      await client.query(
        `INSERT INTO cfg_roles (container_id, name, label, description, permissions, restricted_entity_types, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, description = EXCLUDED.description,
           permissions = EXCLUDED.permissions, restricted_entity_types = EXCLUDED.restricted_entity_types`,
        [containerId, role.name, role.label, role.description, JSON.stringify(role.permissions), JSON.stringify(role.restricted_entity_types), dimension],
      )
    }

    // Workflows
    const dimWorkflows = (manifest.workflows ?? []).filter(w => w.source_dimension === dimension)
    for (const wf of dimWorkflows) {
      await client.query(
        `INSERT INTO cfg_workflows (container_id, name, label, description, entity_type, statuses, transitions, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, description = EXCLUDED.description,
           entity_type = EXCLUDED.entity_type, statuses = EXCLUDED.statuses, transitions = EXCLUDED.transitions`,
        [containerId, wf.name, wf.label, wf.description, wf.entity_type, JSON.stringify(wf.statuses), JSON.stringify(wf.transitions), dimension],
      )
    }

    // Compliance
    const dimCompliance = (manifest.compliance ?? []).filter(c => c.source_dimension === dimension)
    for (const c of dimCompliance) {
      await client.query(
        `INSERT INTO cfg_compliance (container_id, name, standard, description, entity_types, checkpoints, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (container_id, name) DO UPDATE SET
           standard = EXCLUDED.standard, description = EXCLUDED.description,
           entity_types = EXCLUDED.entity_types, checkpoints = EXCLUDED.checkpoints`,
        [containerId, c.name, c.standard, c.description, JSON.stringify(c.entity_types), JSON.stringify(c.checkpoints), dimension],
      )
    }

    // Documents
    const dimDocs = (manifest.documents ?? []).filter(d => d.source_dimension === dimension)
    for (const d of dimDocs) {
      await client.query(
        `INSERT INTO cfg_documents (container_id, name, label, description, entity_type, format, retention_days, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, description = EXCLUDED.description,
           entity_type = EXCLUDED.entity_type, format = EXCLUDED.format, retention_days = EXCLUDED.retention_days`,
        [containerId, d.name, d.label, d.description, d.entity_type ?? null, d.format, d.retention_days ?? null, dimension],
      )
    }

    // Integrations
    const dimIntegrations = (manifest.integrations ?? []).filter(i => i.source_dimension === dimension)
    for (const i of dimIntegrations) {
      await client.query(
        `INSERT INTO cfg_integrations (container_id, name, label, description, system_type, direction, entity_types, config, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, description = EXCLUDED.description,
           system_type = EXCLUDED.system_type, direction = EXCLUDED.direction,
           entity_types = EXCLUDED.entity_types, config = EXCLUDED.config`,
        [containerId, i.name, i.label, i.description, i.system_type, i.direction, JSON.stringify(i.entity_types), JSON.stringify(i.config), dimension],
      )
    }

    // Reports
    const dimReports = (manifest.reports ?? []).filter(r => r.source_dimension === dimension)
    for (const r of dimReports) {
      await client.query(
        `INSERT INTO cfg_reports (container_id, name, label, description, report_type, entity_types, schema, schedule, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, description = EXCLUDED.description,
           report_type = EXCLUDED.report_type, entity_types = EXCLUDED.entity_types,
           schema = EXCLUDED.schema, schedule = EXCLUDED.schedule`,
        [containerId, r.name, r.label, r.description, r.report_type, JSON.stringify(r.entity_types), r.schema ? JSON.stringify(r.schema) : null, r.schedule ?? null, dimension],
      )
    }

    // Edge cases
    const dimEdgeCases = (manifest.edge_cases ?? []).filter(e => e.source_dimension === dimension)
    for (const e of dimEdgeCases) {
      await client.query(
        `INSERT INTO cfg_edge_cases (container_id, name, label, description, category, entity_types, handling, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, description = EXCLUDED.description,
           category = EXCLUDED.category, entity_types = EXCLUDED.entity_types, handling = EXCLUDED.handling`,
        [containerId, e.name, e.label, e.description, e.category, JSON.stringify(e.entity_types), e.handling, dimension],
      )
    }

    // Notifications (D9)
    const dimNotifications = (manifest.notifications ?? []).filter(n => n.source_dimension === dimension)
    for (const n of dimNotifications) {
      await client.query(
        `INSERT INTO cfg_notifications (container_id, name, label, description, trigger_entity_type, trigger_event, trigger_condition, recipients, channel, escalation_minutes, escalation_to, template, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, description = EXCLUDED.description,
           trigger_entity_type = EXCLUDED.trigger_entity_type, trigger_event = EXCLUDED.trigger_event,
           trigger_condition = EXCLUDED.trigger_condition, recipients = EXCLUDED.recipients,
           channel = EXCLUDED.channel, escalation_minutes = EXCLUDED.escalation_minutes,
           escalation_to = EXCLUDED.escalation_to, template = EXCLUDED.template`,
        [containerId, n.name, n.label, n.description, n.trigger_entity_type, n.trigger_event,
         n.trigger_condition ?? null, JSON.stringify(n.recipients), n.channel,
         n.escalation_minutes ?? null, n.escalation_to ?? null, n.template ?? null, dimension],
      )
    }

    // UI configs (D10)
    const dimUIConfigs = (manifest.ui_configs ?? []).filter(u => u.source_dimension === dimension)
    for (const u of dimUIConfigs) {
      await client.query(
        `INSERT INTO cfg_ui_configs (container_id, name, label, entity_type, view_type, grid_config, detail_config, navigation, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, entity_type = EXCLUDED.entity_type,
           view_type = EXCLUDED.view_type, grid_config = EXCLUDED.grid_config,
           detail_config = EXCLUDED.detail_config, navigation = EXCLUDED.navigation`,
        [containerId, u.name, u.label, u.entity_type, u.view_type,
         JSON.stringify(u.grid_config), JSON.stringify(u.detail_config ?? {}),
         JSON.stringify(u.navigation ?? {}), dimension],
      )
    }

    // Pages (D11)
    const dimPages = (manifest.pages ?? []).filter(p => p.source_dimension === dimension)
    for (const p of dimPages) {
      await client.query(
        `INSERT INTO cfg_pages (container_id, name, label, route, icon, layout, sections, is_default, access_roles, sort_order, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, route = EXCLUDED.route, icon = EXCLUDED.icon,
           layout = EXCLUDED.layout, sections = EXCLUDED.sections,
           is_default = EXCLUDED.is_default, access_roles = EXCLUDED.access_roles,
           sort_order = EXCLUDED.sort_order`,
        [containerId, p.name, p.label, p.route, p.icon ?? null, p.layout,
         JSON.stringify(p.sections), p.is_default ?? false,
         p.access_roles ? JSON.stringify(p.access_roles) : null,
         p.is_default ? 0 : 99, dimension],
      )
    }
  })
}
