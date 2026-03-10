export interface Container {
  id: string
  name: string
  slug: string | null
  description: string | null
  status: 'draft' | 'review' | 'locked' | 'launched'
  manifest: ContainerManifest
  created_at: string
  updated_at: string
}

export interface ContainerManifest {
  entity_types?: EntityTypeDef[]
  relations?: RelationDef[]
  navigation?: Array<{ label: string; children: string[] }>
  scope?: string[]
  out_of_scope?: string[]
}

export interface EntityTypeDef {
  name: string
  description: string
  schema: Record<string, any> | null
  key_fields?: string[]
  reviewed?: boolean
  source_dimension?: string
}

export interface RelationDef {
  source_type: string
  target_type: string
  relation_type: string
  description?: string
}

// Exploration types
export type ExplorationPhase = 'first_pass' | 'holistic_review' | 'explore' | 'locked'
export type StepName = 'generate' | 'self_review' | 'gaps' | 'gate'
export type StepStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'error'
export type GateDecision = 'continue' | 'go_deeper' | 'skip' | 'stop'

export interface DimensionConfig {
  dimension: string
  label: string
  description: string
  sort_order: number
  is_active: boolean
}

export interface ExplorationRun {
  id: string
  container_id: string
  phase: ExplorationPhase
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  current_dimension: string | null
  current_step: StepName | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface ExplorationStep {
  id: string
  run_id: string
  dimension: string
  step: StepName
  status: StepStatus
  llm_output: string | null
  entity_types_added: Array<{ name: string; description: string; key_fields?: string[] }>
  entity_types_modified: Array<{ name: string; changes: Record<string, any> }>
  relations_added: RelationDef[]
  relations_modified: Array<{ source_type: string; target_type: string; changes: Record<string, any> }>
  explore_opportunities: Array<{ dimension: string; topic: string; reason: string }>
  out_of_scope_items: Array<{ item: string; reason: string }>
  gate_decision: GateDecision | null
  gate_notes: string | null
  created_at: string
}

export interface ExplorationProgress {
  run: ExplorationRun
  dimensions: DimensionConfig[]
  steps: ExplorationStep[]
  completedDimensions: string[]
  currentDimension: DimensionConfig | null
  currentStep: StepName | null
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export type MessageSegment =
  | { kind: 'html'; html: string }
  | { kind: 'schema'; name: string; description: string; schema: Record<string, any> }
  | { kind: 'meta' }
