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
    await repo.updateRun(run.id, { status: 'paused', current_step: null })
    return { run: (await repo.findRunById(run.id))!, isDone: true }
  }

  if (decision === 'go_deeper') {
    // Re-run this dimension from generate
    await repo.updateRun(run.id, { current_step: 'generate' })
    return { run: (await repo.findRunById(run.id))!, isDone: false }
  }

  if (decision === 'skip' || decision === 'continue') {
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
        // Move to holistic review
        await repo.updateRun(run.id, {
          phase: 'holistic_review',
          current_dimension: null,
          current_step: null,
          status: 'completed',
        })
        return { run: (await repo.findRunById(run.id))!, isDone: true }
      }
      // Exploration complete
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
  parsed: {
    entity_types_added?: Array<{ name: string; description: string; key_fields?: string[] }>
    entity_types_modified?: Array<{ name: string; changes: Record<string, any> }>
    relations_added?: Array<{ source_type: string; target_type: string; relation_type: string; description?: string }>
    scope_items?: string[]
    out_of_scope_items?: Array<{ item: string; reason: string }>
  },
  currentManifest: ContainerManifest,
): Promise<void> {
  const manifest = { ...currentManifest }
  manifest.entity_types = [...(manifest.entity_types ?? [])]
  manifest.relations = [...(manifest.relations ?? [])]
  manifest.scope = [...(manifest.scope ?? [])]
  manifest.out_of_scope = [...(manifest.out_of_scope ?? [])]

  // Add new entity types
  if (parsed.entity_types_added?.length) {
    for (const et of parsed.entity_types_added) {
      const existing = manifest.entity_types.find(e => e.name === et.name)
      if (!existing) {
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
      const exists = manifest.relations.some(
        r => r.source_type === rel.source_type && r.target_type === rel.target_type && r.relation_type === rel.relation_type,
      )
      if (!exists) {
        manifest.relations.push(rel)
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
