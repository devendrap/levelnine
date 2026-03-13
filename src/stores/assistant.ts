import { atom } from 'nanostores'

export interface PageContext {
  page: 'dashboard' | 'list' | 'detail' | 'new'
  entityType?: string
  entityId?: string
  entityStatus?: string
}

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: Array<{ name: string; args: Record<string, any> }>
  toolResults?: Array<{ name: string; result: any; success: boolean }>
  createdAt: string
}

export const $assistantOpen = atom<boolean>(false)
export const $assistantContext = atom<PageContext>({ page: 'dashboard' })
export const $assistantMessages = atom<AssistantMessage[]>([])
export const $assistantStreaming = atom<boolean>(false)
export const $assistantSlug = atom<string>('')
export const $assistantContainerId = atom<string>('')
