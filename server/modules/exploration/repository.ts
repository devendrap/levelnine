import { query } from '../../db/index'
import type {
  DimensionConfig,
  ExplorationRun,
  ExplorationStep,
  ManifestSnapshot,
  ExplorationPhase,
  ExplorationRunStatus,
  StepName,
  StepStatus,
  GateDecision,
  ContainerManifest,
} from '../../core/types/index'

// ============================================================================
// Dimension Configs
// ============================================================================

export async function findAllDimensions(activeOnly = true): Promise<DimensionConfig[]> {
  const where = activeOnly ? 'WHERE is_active = true' : ''
  const result = await query<DimensionConfig>(`SELECT * FROM exp_dimensions ${where} ORDER BY sort_order`)
  return result.rows
}

export async function findDimensionByKey(dimension: string): Promise<DimensionConfig | null> {
  const result = await query<DimensionConfig>('SELECT * FROM exp_dimensions WHERE dimension = $1', [dimension])
  return result.rows[0] ?? null
}

// ============================================================================
// Exploration Runs
// ============================================================================

export async function findRunById(id: string): Promise<ExplorationRun | null> {
  const result = await query<ExplorationRun>('SELECT * FROM exp_runs WHERE id = $1', [id])
  return result.rows[0] ?? null
}

export async function findActiveRun(containerId: string): Promise<ExplorationRun | null> {
  const result = await query<ExplorationRun>(
    `SELECT * FROM exp_runs WHERE container_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    [containerId],
  )
  return result.rows[0] ?? null
}

export async function findRunsByContainer(containerId: string): Promise<ExplorationRun[]> {
  const result = await query<ExplorationRun>(
    'SELECT * FROM exp_runs WHERE container_id = $1 ORDER BY created_at DESC',
    [containerId],
  )
  return result.rows
}

export async function insertRun(data: {
  container_id: string
  phase?: ExplorationPhase
}): Promise<ExplorationRun> {
  const result = await query<ExplorationRun>(
    `INSERT INTO exp_runs (container_id, phase) VALUES ($1, $2) RETURNING *`,
    [data.container_id, data.phase ?? 'first_pass'],
  )
  return result.rows[0]
}

export async function updateRun(
  id: string,
  data: {
    phase?: ExplorationPhase
    status?: ExplorationRunStatus
    current_dimension?: string | null
    current_step?: StepName | null
    metadata?: Record<string, any>
  },
): Promise<ExplorationRun | null> {
  const sets: string[] = []
  const params: any[] = []
  let idx = 1

  if (data.phase !== undefined) { sets.push(`phase = $${idx++}`); params.push(data.phase) }
  if (data.status !== undefined) { sets.push(`status = $${idx++}`); params.push(data.status) }
  if (data.current_dimension !== undefined) { sets.push(`current_dimension = $${idx++}`); params.push(data.current_dimension) }
  if (data.current_step !== undefined) { sets.push(`current_step = $${idx++}`); params.push(data.current_step) }
  if (data.metadata !== undefined) { sets.push(`metadata = $${idx++}`); params.push(JSON.stringify(data.metadata)) }

  if (sets.length === 0) return findRunById(id)

  sets.push('updated_at = NOW()')
  params.push(id)
  const result = await query<ExplorationRun>(
    `UPDATE exp_runs SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params,
  )
  return result.rows[0] ?? null
}

// ============================================================================
// Exploration Steps
// ============================================================================

export async function findStepsByRun(runId: string): Promise<ExplorationStep[]> {
  const result = await query<ExplorationStep>(
    'SELECT * FROM exp_steps WHERE run_id = $1 ORDER BY created_at',
    [runId],
  )
  return result.rows
}

export async function findStepById(id: string): Promise<ExplorationStep | null> {
  const result = await query<ExplorationStep>('SELECT * FROM exp_steps WHERE id = $1', [id])
  return result.rows[0] ?? null
}

export async function findStepByRunDimensionStep(
  runId: string,
  dimension: string,
  step: StepName,
): Promise<ExplorationStep | null> {
  const result = await query<ExplorationStep>(
    'SELECT * FROM exp_steps WHERE run_id = $1 AND dimension = $2 AND step = $3',
    [runId, dimension, step],
  )
  return result.rows[0] ?? null
}

export async function insertStep(data: {
  run_id: string
  dimension: string
  step: StepName
}): Promise<ExplorationStep> {
  const result = await query<ExplorationStep>(
    `INSERT INTO exp_steps (run_id, dimension, step) VALUES ($1, $2, $3) RETURNING *`,
    [data.run_id, data.dimension, data.step],
  )
  return result.rows[0]
}

export async function updateStep(
  id: string,
  data: {
    status?: StepStatus
    llm_output?: string
    entity_types_added?: any[]
    entity_types_modified?: any[]
    relations_added?: any[]
    relations_modified?: any[]
    explore_opportunities?: any[]
    out_of_scope_items?: any[]
    gate_decision?: GateDecision
    gate_notes?: string
  },
): Promise<ExplorationStep | null> {
  const sets: string[] = []
  const params: any[] = []
  let idx = 1

  if (data.status !== undefined) { sets.push(`status = $${idx++}`); params.push(data.status) }
  if (data.llm_output !== undefined) { sets.push(`llm_output = $${idx++}`); params.push(data.llm_output) }
  if (data.entity_types_added !== undefined) { sets.push(`entity_types_added = $${idx++}`); params.push(JSON.stringify(data.entity_types_added)) }
  if (data.entity_types_modified !== undefined) { sets.push(`entity_types_modified = $${idx++}`); params.push(JSON.stringify(data.entity_types_modified)) }
  if (data.relations_added !== undefined) { sets.push(`relations_added = $${idx++}`); params.push(JSON.stringify(data.relations_added)) }
  if (data.relations_modified !== undefined) { sets.push(`relations_modified = $${idx++}`); params.push(JSON.stringify(data.relations_modified)) }
  if (data.explore_opportunities !== undefined) { sets.push(`explore_opportunities = $${idx++}`); params.push(JSON.stringify(data.explore_opportunities)) }
  if (data.out_of_scope_items !== undefined) { sets.push(`out_of_scope_items = $${idx++}`); params.push(JSON.stringify(data.out_of_scope_items)) }
  if (data.gate_decision !== undefined) { sets.push(`gate_decision = $${idx++}`); params.push(data.gate_decision) }
  if (data.gate_notes !== undefined) { sets.push(`gate_notes = $${idx++}`); params.push(data.gate_notes) }

  if (sets.length === 0) return findStepById(id)

  sets.push('updated_at = NOW()')
  params.push(id)
  const result = await query<ExplorationStep>(
    `UPDATE exp_steps SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params,
  )
  return result.rows[0] ?? null
}

// ============================================================================
// Manifest Snapshots
// ============================================================================

export async function insertSnapshot(data: {
  container_id: string
  run_id: string
  dimension: string
  manifest: ContainerManifest
}): Promise<ManifestSnapshot> {
  const result = await query<ManifestSnapshot>(
    `INSERT INTO exp_snapshots (container_id, run_id, dimension, manifest) VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.container_id, data.run_id, data.dimension, JSON.stringify(data.manifest)],
  )
  return result.rows[0]
}

export async function findSnapshotsByRun(runId: string): Promise<ManifestSnapshot[]> {
  const result = await query<ManifestSnapshot>(
    'SELECT * FROM exp_snapshots WHERE run_id = $1 ORDER BY created_at',
    [runId],
  )
  return result.rows
}

export async function findSnapshotsByContainer(containerId: string): Promise<ManifestSnapshot[]> {
  const result = await query<ManifestSnapshot>(
    'SELECT * FROM exp_snapshots WHERE container_id = $1 ORDER BY created_at',
    [containerId],
  )
  return result.rows
}
