import * as repo from './repository'
import * as containerRepo from '../containers/repository'
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

  const context: Record<string, any> = {
    allDimensions: dimensions.map(d => d.label),
    completedDimensions: completedDimensions.map(d => d.label),
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
        { role: 'system', content: `You are an expert industry analyst performing a structured exploration of the "${container.name}" domain. Be thorough, specific, and use real industry terminology.` },
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
// Gate Decision
// ============================================================================

export async function submitGateDecision(
  stepId: string,
  decision: GateDecision,
  notes?: string,
): Promise<{ run: ExplorationRun; isDone: boolean }> {
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

  const dimensions = await repo.findAllDimensions()
  const currentIdx = dimensions.findIndex(d => d.dimension === step.dimension)

  if (decision === 'stop') {
    // Materialize what we have for this dimension before stopping
    if (container) {
      await materializeDimension(run.container_id, step.dimension, container.manifest as ContainerManifest)
    }
    await repo.updateRun(run.id, { status: 'paused', current_step: null })
    return { run: (await repo.findRunById(run.id))!, isDone: true }
  }

  if (decision === 'go_deeper') {
    // Re-run this dimension from generate — don't materialize yet
    await repo.updateRun(run.id, { current_step: 'generate' })
    return { run: (await repo.findRunById(run.id))!, isDone: false }
  }

  if (decision === 'skip' || decision === 'continue') {
    // Gate approved — materialize this dimension's artifacts into DB rows
    if (container) {
      await materializeDimension(run.container_id, step.dimension, container.manifest as ContainerManifest)
    }

    // Move to next dimension
    const nextIdx = currentIdx + 1
    if (nextIdx < dimensions.length) {
      await repo.updateRun(run.id, {
        current_dimension: dimensions[nextIdx].dimension,
        current_step: 'generate',
      })
      return { run: (await repo.findRunById(run.id))!, isDone: false }
    } else {
      // All dimensions done — check phase
      if (run.phase === 'first_pass') {
        await repo.updateRun(run.id, {
          phase: 'holistic_review',
          current_dimension: null,
          current_step: null,
          status: 'completed',
        })
        return { run: (await repo.findRunById(run.id))!, isDone: true }
      }
      await repo.updateRun(run.id, { status: 'completed', current_step: null })
      return { run: (await repo.findRunById(run.id))!, isDone: true }
    }
  }

  return { run: (await repo.findRunById(run.id))!, isDone: false }
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

  // Add new entity types
  if (parsed.entity_types_added?.length) {
    for (const et of parsed.entity_types_added) {
      if (!manifest.entity_types.find(e => e.name === et.name)) {
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
    for (const mod of parsed.entity_types_modified) {
      const existing = manifest.entity_types.find(e => e.name === mod.name)
      if (existing && !existing.reviewed) {
        if (mod.changes.description) existing.description = mod.changes.description
        if (mod.changes.key_fields) existing.key_fields = mod.changes.key_fields
      }
    }
  }

  // Add relations
  if (parsed.relations_added?.length) {
    for (const rel of parsed.relations_added) {
      if (!manifest.relations.some(r => r.source_type === rel.source_type && r.target_type === rel.target_type && r.relation_type === rel.relation_type)) {
        manifest.relations.push({ ...rel, source_dimension: dimension })
      }
    }
  }

  // D2: Roles
  if (parsed.roles_added?.length) {
    for (const role of parsed.roles_added) {
      if (!manifest.roles.find(r => r.name === role.name)) {
        manifest.roles.push({ ...role, source_dimension: dimension })
      }
    }
  }

  // D3: Workflows
  if (parsed.workflows_added?.length) {
    for (const wf of parsed.workflows_added) {
      if (!manifest.workflows.find(w => w.name === wf.name)) {
        manifest.workflows.push({ ...wf, source_dimension: dimension })
      }
    }
  }

  // D4: Compliance
  if (parsed.compliance_added?.length) {
    for (const c of parsed.compliance_added) {
      if (!manifest.compliance.find(x => x.name === c.name)) {
        manifest.compliance.push({ ...c, source_dimension: dimension })
      }
    }
  }

  // D5: Documents
  if (parsed.documents_added?.length) {
    for (const d of parsed.documents_added) {
      if (!manifest.documents.find(x => x.name === d.name)) {
        manifest.documents.push({ ...d, source_dimension: dimension })
      }
    }
  }

  // D6: Integrations
  if (parsed.integrations_added?.length) {
    for (const i of parsed.integrations_added) {
      if (!manifest.integrations.find(x => x.name === i.name)) {
        manifest.integrations.push({ ...i, source_dimension: dimension })
      }
    }
  }

  // D7: Reports
  if (parsed.reports_added?.length) {
    for (const r of parsed.reports_added) {
      if (!manifest.reports.find(x => x.name === r.name)) {
        manifest.reports.push({ ...r, source_dimension: dimension })
      }
    }
  }

  // D8: Edge cases
  if (parsed.edge_cases_added?.length) {
    for (const e of parsed.edge_cases_added) {
      if (!manifest.edge_cases.find(x => x.name === e.name)) {
        manifest.edge_cases.push({ ...e, source_dimension: dimension })
      }
    }
  }

  // D9: Notifications
  manifest.notifications = [...(manifest.notifications ?? [])]
  if (parsed.notifications_added?.length) {
    for (const n of parsed.notifications_added) {
      if (!manifest.notifications.find(x => x.name === n.name)) {
        manifest.notifications.push({ ...n, source_dimension: dimension })
      }
    }
  }

  // D10: UI configs
  manifest.ui_configs = [...(manifest.ui_configs ?? [])]
  if (parsed.ui_configs_added?.length) {
    for (const u of parsed.ui_configs_added) {
      if (!manifest.ui_configs.find(x => x.name === u.name)) {
        manifest.ui_configs.push({ ...u, source_dimension: dimension })
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
    // Entity types — insert/upsert those from this dimension
    const dimEntityTypes = (manifest.entity_types ?? []).filter(et => et.source_dimension === dimension)
    for (const et of dimEntityTypes) {
      await client.query(
        `INSERT INTO entity_types (name, description, schema, container_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (name, COALESCE(container_id, '00000000-0000-0000-0000-000000000000')) DO UPDATE SET
           description = EXCLUDED.description, schema = EXCLUDED.schema, updated_at = NOW()`,
        [et.name, et.description, et.schema ? JSON.stringify(et.schema) : null, containerId],
      )
    }

    // Relations
    const dimRelations = (manifest.relations ?? []).filter(r => r.source_dimension === dimension)
    for (const rel of dimRelations) {
      await client.query(
        `INSERT INTO container_relations (container_id, source_type, target_type, relation_type, description, source_dimension)
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
        `INSERT INTO container_roles (container_id, name, label, description, permissions, can_access_entity_types, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, description = EXCLUDED.description,
           permissions = EXCLUDED.permissions, can_access_entity_types = EXCLUDED.can_access_entity_types`,
        [containerId, role.name, role.label, role.description, JSON.stringify(role.permissions), JSON.stringify(role.can_access_entity_types), dimension],
      )
    }

    // Workflows
    const dimWorkflows = (manifest.workflows ?? []).filter(w => w.source_dimension === dimension)
    for (const wf of dimWorkflows) {
      await client.query(
        `INSERT INTO container_workflows (container_id, name, label, description, entity_type, statuses, transitions, source_dimension)
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
        `INSERT INTO container_compliance (container_id, name, standard, description, entity_types, checkpoints, source_dimension)
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
        `INSERT INTO container_documents (container_id, name, label, description, entity_type, format, retention_days, source_dimension)
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
        `INSERT INTO container_integrations (container_id, name, label, description, system_type, direction, entity_types, config, source_dimension)
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
        `INSERT INTO container_reports (container_id, name, label, description, report_type, entity_types, schema, schedule, source_dimension)
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
        `INSERT INTO container_edge_cases (container_id, name, label, description, category, entity_types, handling, source_dimension)
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
        `INSERT INTO container_notifications (container_id, name, label, description, trigger_entity_type, trigger_event, trigger_condition, recipients, channel, escalation_minutes, escalation_to, template, source_dimension)
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
        `INSERT INTO container_ui_configs (container_id, name, label, entity_type, view_type, grid_config, detail_config, navigation, source_dimension)
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
  })
}
