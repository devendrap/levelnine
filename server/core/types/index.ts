export interface User {
  id: string
  email: string
  name: string
  password_hash: string
  role: 'admin' | 'partner' | 'manager' | 'staff' | 'viewer'
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface EntityType {
  id: string
  name: string
  description: string | null
  schema: Record<string, any> | null
  data_schema: Record<string, any> | null
  field_metadata: Record<string, { default?: any; searchable?: boolean; sortable?: boolean; show_in_list?: boolean }> | null
  related_types: Array<{ type: string; relation: string; display: string }> | null
  document_slots: string[] | null
  report_relevance: string[] | null
  container_id: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface Entity {
  id: string
  entity_type_id: string
  container_id: string | null
  name: string
  status: 'draft' | 'active' | 'review' | 'approved' | 'archived'
  content: Record<string, any>
  metadata: Record<string, any>
  period: string | null
  s3_key: string | null
  original_filename: string | null
  processing_status: 'pending' | 'processing' | 'complete' | 'error'
  created_by_user_id: string | null
  last_modified_by_user_id: string | null
  created_at: Date
  updated_at: Date
}

export interface EntityRelation {
  id: string
  source_entity_id: string
  target_entity_id: string
  relation_type: string
  metadata: Record<string, any>
  created_at: Date
}

export interface Container {
  id: string
  name: string
  slug: string | null
  description: string | null
  status: 'draft' | 'review' | 'locked' | 'launched'
  manifest: ContainerManifest
  created_by_user_id: string | null
  created_at: Date
  updated_at: Date
}

export interface ContainerManifest {
  entity_types?: Array<{
    name: string
    description: string
    schema: Record<string, any> | null
    key_fields?: string[]
    data_schema?: Record<string, any> | null
    field_metadata?: Record<string, { default?: any; searchable?: boolean; sortable?: boolean; show_in_list?: boolean }> | null
    related_types?: Array<{ type: string; relation: string; display: string }> | null
    document_slots?: string[] | null
    report_relevance?: string[] | null
    reviewed?: boolean
    source_dimension?: string
  }>
  relations?: Array<{
    source_type: string
    target_type: string
    relation_type: string
    description?: string
    source_dimension?: string
  }>
  roles?: Array<{
    name: string
    label: string
    description: string
    permissions: string[]
    restricted_entity_types: Array<{ type: string; justification: string }>
    source_dimension?: string
  }>
  workflows?: Array<{
    name: string
    label: string
    description: string
    entity_type: string
    statuses: string[]
    transitions: Array<{ from: string; to: string; role: string; conditions?: string }>
    source_dimension?: string
  }>
  compliance?: Array<{
    name: string
    standard: string
    description: string
    entity_types: string[]
    checkpoints: string[]
    source_dimension?: string
  }>
  documents?: Array<{
    name: string
    label: string
    description: string
    entity_type?: string
    format: string
    retention_days?: number
    source_dimension?: string
  }>
  integrations?: Array<{
    name: string
    label: string
    description: string
    system_type: string
    direction: string
    entity_types: string[]
    config: Record<string, any>
    source_dimension?: string
  }>
  reports?: Array<{
    name: string
    label: string
    description: string
    report_type: string
    entity_types: string[]
    schema?: Record<string, any>
    schedule?: string
    source_dimension?: string
  }>
  edge_cases?: Array<{
    name: string
    label: string
    description: string
    category: string
    entity_types: string[]
    handling: string
    source_dimension?: string
  }>
  notifications?: Array<{
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
  }>
  ui_configs?: Array<{
    name: string
    label: string
    entity_type: string
    view_type: string
    grid_config: Record<string, any>
    detail_config?: Record<string, any>
    navigation?: Record<string, any>
    source_dimension?: string
  }>
  navigation?: Array<{
    label: string
    children: string[]
  }>
  scope?: string[]
  out_of_scope?: string[]
}

export interface ContainerMessage {
  id: string
  container_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata: Record<string, any>
  created_at: Date
}

export interface AppUser {
  id: string
  container_id: string
  email: string
  name: string
  password_hash: string
  role: 'admin' | 'editor' | 'viewer'
  domain_role: string | null
  is_active: boolean
  invited_by: string | null
  created_at: Date
  updated_at: Date
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Exploration types
export interface DimensionConfig {
  id: string
  dimension: string
  label: string
  description: string
  system_prompt: string
  sort_order: number
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export type ExplorationPhase = 'first_pass' | 'holistic_review' | 'explore' | 'locked'
export type ExplorationRunStatus = 'active' | 'paused' | 'completed' | 'cancelled'
export type StepName = 'generate' | 'self_review' | 'gaps' | 'gate'
export type StepStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'error'
export type GateDecision = 'continue' | 'go_deeper' | 'skip' | 'stop'

export interface ExplorationRun {
  id: string
  container_id: string
  phase: ExplorationPhase
  status: ExplorationRunStatus
  current_dimension: string | null
  current_step: StepName | null
  metadata: Record<string, any>
  created_at: Date
  updated_at: Date
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
  relations_added: Array<{ source_type: string; target_type: string; relation_type: string; description?: string }>
  relations_modified: Array<{ source_type: string; target_type: string; changes: Record<string, any> }>
  explore_opportunities: Array<{ dimension: string; topic: string; reason: string }>
  out_of_scope_items: Array<{ item: string; reason: string }>
  gate_decision: GateDecision | null
  gate_notes: string | null
  created_at: Date
  updated_at: Date
}

export interface ManifestSnapshot {
  id: string
  container_id: string
  run_id: string
  dimension: string
  manifest: ContainerManifest
  created_at: Date
}
