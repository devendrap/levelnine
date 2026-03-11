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
  roles?: RoleDef[]
  workflows?: WorkflowDef[]
  compliance?: ComplianceDef[]
  documents?: DocumentDef[]
  integrations?: IntegrationDef[]
  reports?: ReportDef[]
  edge_cases?: EdgeCaseDef[]
  notifications?: NotificationRuleDef[]
  ui_configs?: UIConfigDef[]
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
  source_dimension?: string
}

export interface RoleDef {
  name: string
  label: string
  description: string
  permissions: string[]
  can_access_entity_types: string[]
  source_dimension?: string
}

export interface WorkflowDef {
  name: string
  label: string
  description: string
  entity_type: string
  statuses: string[]
  transitions: Array<{ from: string; to: string; role: string; conditions?: string }>
  source_dimension?: string
}

export interface ComplianceDef {
  name: string
  standard: string
  description: string
  entity_types: string[]
  checkpoints: string[]
  source_dimension?: string
}

export interface DocumentDef {
  name: string
  label: string
  description: string
  entity_type?: string
  format: string
  retention_days?: number
  source_dimension?: string
}

export interface IntegrationDef {
  name: string
  label: string
  description: string
  system_type: string
  direction: string
  entity_types: string[]
  config: Record<string, any>
  source_dimension?: string
}

export interface ReportDef {
  name: string
  label: string
  description: string
  report_type: string
  entity_types: string[]
  schema?: Record<string, any>
  schedule?: string
  source_dimension?: string
}

export interface EdgeCaseDef {
  name: string
  label: string
  description: string
  category: string
  entity_types: string[]
  handling: string
  source_dimension?: string
}

export interface NotificationRuleDef {
  name: string
  label: string
  description: string
  trigger_entity_type: string
  trigger_event: string
  trigger_condition?: string
  recipients: string[]
  channel: string
  escalation_minutes?: number
  escalation_to?: string
  template?: string
  source_dimension?: string
}

export interface UIConfigDef {
  name: string
  label: string
  entity_type: string
  view_type: string
  grid_config: Record<string, any>
  detail_config?: Record<string, any>
  navigation?: Record<string, any>
  source_dimension?: string
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
