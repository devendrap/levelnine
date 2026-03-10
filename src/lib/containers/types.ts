export interface Container {
  id: string
  name: string
  description: string | null
  status: 'draft' | 'review' | 'locked'
  manifest: ContainerManifest
  created_at: string
  updated_at: string
}

export interface ContainerManifest {
  entity_types?: EntityTypeDef[]
  navigation?: Array<{ label: string; children: string[] }>
}

export interface EntityTypeDef {
  name: string
  description: string
  schema: Record<string, any> | null
  key_fields?: string[]
  reviewed?: boolean
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
