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
  parent_entity_id: string | null
  period: string | null
  s3_key: string | null
  original_filename: string | null
  processing_status: 'pending' | 'processing' | 'complete' | 'error'
  created_by_user_id: string | null
  last_modified_by_user_id: string | null
  created_at: Date
  updated_at: Date
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
    reviewed?: boolean
  }>
  navigation?: Array<{
    label: string
    children: string[]
  }>
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
