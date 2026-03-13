/**
 * App Assistant — Chat Service
 *
 * Orchestrates the AI assistant conversation with streaming responses
 * and server-side tool execution loop.
 */

import { query } from '../../db/index'
import { getClient, getModel, type Provider } from '../../../src/api/providers'
import { buildAssistantSystemPrompt } from './prompt'
import { getToolsForContext, executeTool } from './tools'
import * as containerRepo from '../containers/repository'
import * as entityService from '../entities/service'
import type { Container, EntityType } from '../../core/types/index'

interface PageContext {
  page: 'dashboard' | 'list' | 'detail' | 'new'
  entityType?: string
  entityId?: string
  entityStatus?: string
}

interface ChatContext {
  containerId: string
  userId: string
  userRole?: string
  slug: string
  pageContext: PageContext
}

// ============================================================================
// Chat History
// ============================================================================

async function loadChatHistory(
  containerId: string,
  userId: string,
  pageContext: PageContext,
  limit: number = 20,
): Promise<Array<{ role: string; content: string; tool_calls?: any; tool_results?: any }>> {
  const contextKey = pageContext.entityId
    ? `${pageContext.page}:${pageContext.entityType}:${pageContext.entityId}`
    : `${pageContext.page}:${pageContext.entityType ?? 'dashboard'}`

  const result = await query<any>(
    `SELECT role, content, tool_calls, tool_results FROM app_chat_messages
     WHERE container_id = $1 AND user_id = $2
       AND page_context->>'key' = $3
     ORDER BY created_at DESC
     LIMIT $4`,
    [containerId, userId, contextKey, limit],
  )

  return result.rows.reverse()
}

async function saveMessage(
  containerId: string,
  userId: string,
  pageContext: PageContext,
  role: string,
  content: string | null,
  toolCalls?: any,
  toolResults?: any,
): Promise<void> {
  const contextKey = pageContext.entityId
    ? `${pageContext.page}:${pageContext.entityType}:${pageContext.entityId}`
    : `${pageContext.page}:${pageContext.entityType ?? 'dashboard'}`

  await query(
    `INSERT INTO app_chat_messages (container_id, user_id, page_context, role, content, tool_calls, tool_results)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      containerId,
      userId,
      JSON.stringify({ ...pageContext, key: contextKey }),
      role,
      content,
      toolCalls ? JSON.stringify(toolCalls) : null,
      toolResults ? JSON.stringify(toolResults) : null,
    ],
  )
}

// ============================================================================
// Streaming Chat
// ============================================================================

/**
 * Main chat function. Uses non-streaming for tool calls (Ollama compatibility),
 * streams the final text response.
 */
export async function chatWithAssistant(
  context: ChatContext,
  userMessage: string,
  provider: Provider = 'ollama',
  model?: string,
  onChunk?: (event: string, data: any) => void,
): Promise<{ content: string; toolResults: any[] }> {
  const emit = onChunk ?? (() => {})

  // Load container and entity types
  const container = await containerRepo.findContainerById(context.containerId)
  if (!container) throw new Error('Container not found')

  const entityTypes = await entityService.listEntityTypes(true, context.containerId)

  // Build system prompt
  const systemPrompt = await buildAssistantSystemPrompt(
    container,
    context.pageContext,
    entityTypes,
    context.userRole,
  )

  // Load chat history
  const history = await loadChatHistory(context.containerId, context.userId, context.pageContext)

  // Save user message
  await saveMessage(context.containerId, context.userId, context.pageContext, 'user', userMessage)

  // Build messages array for the LLM
  const messages: any[] = [
    { role: 'system', content: systemPrompt },
  ]

  // Add history (only user/assistant messages — skip tool messages for simplicity)
  for (const msg of history) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content ?? '' })
    }
  }

  // Add current user message
  messages.push({ role: 'user', content: userMessage })

  // Get available tools
  const tools = getToolsForContext(context.pageContext)

  // LLM client
  const { client } = getClient(provider)
  const modelId = getModel(provider, model)

  const allToolResults: any[] = []
  let iterations = 0
  const MAX_ITERATIONS = 5

  // Phase 1: Non-streaming tool loop — resolve all tool calls first
  while (iterations < MAX_ITERATIONS) {
    iterations++

    try {
      const completion = await client.chat.completions.create({
        model: modelId,
        messages,
        tools: tools.length > 0 ? tools : undefined,
      })

      const choice = completion.choices?.[0]
      if (!choice) break

      const assistantMessage = choice.message

      // If no tool calls, we have the final response — stream it out
      if (!assistantMessage.tool_calls?.length) {
        const text = assistantMessage.content ?? ''
        // Stream the final text chunk by chunk (simulate streaming for UX)
        const words = text.split(' ')
        let buffer = ''
        for (let i = 0; i < words.length; i++) {
          buffer += (i > 0 ? ' ' : '') + words[i]
          if (buffer.length >= 20 || i === words.length - 1) {
            emit('chunk', { text: buffer })
            buffer = ''
          }
        }

        // Save and return
        await saveMessage(context.containerId, context.userId, context.pageContext, 'assistant', text)
        return { content: text, toolResults: allToolResults }
      }

      // Tool calls — execute them and continue the loop
      messages.push({
        role: 'assistant',
        content: assistantMessage.content ?? null,
        tool_calls: assistantMessage.tool_calls,
      })

      for (const tc of assistantMessage.tool_calls) {
        const toolName = tc.function.name
        let toolArgs: Record<string, any> = {}
        try {
          toolArgs = JSON.parse(tc.function.arguments || '{}')
        } catch {
          toolArgs = {}
        }

        emit('tool_call', { name: toolName, args: toolArgs })

        const toolResult = await executeTool(toolName, toolArgs, {
          containerId: context.containerId,
          userId: context.userId,
          userRole: context.userRole,
          slug: context.slug,
          pageContext: context.pageContext,
        })

        allToolResults.push({ name: toolName, ...toolResult })
        emit('tool_result', { name: toolName, ...toolResult })

        // Add tool result message with matching call ID
        messages.push({
          role: 'tool',
          content: JSON.stringify(toolResult),
          tool_call_id: tc.id,
        })
      }

      // Continue loop — LLM will process tool results

    } catch (err: any) {
      emit('error', { error: err.message })
      throw err
    }
  }

  // If we exhausted iterations, return what we have
  const fallback = 'I completed the requested actions. Is there anything else you need?'
  emit('chunk', { text: fallback })
  await saveMessage(context.containerId, context.userId, context.pageContext, 'assistant', fallback)
  return { content: fallback, toolResults: allToolResults }
}

/**
 * Get chat history for a page context (for loading previous conversation).
 */
export async function getChatHistory(
  containerId: string,
  userId: string,
  pageContext: PageContext,
  limit: number = 50,
): Promise<any[]> {
  const contextKey = pageContext.entityId
    ? `${pageContext.page}:${pageContext.entityType}:${pageContext.entityId}`
    : `${pageContext.page}:${pageContext.entityType ?? 'dashboard'}`

  const result = await query<any>(
    `SELECT id, role, content, tool_calls, tool_results, created_at FROM app_chat_messages
     WHERE container_id = $1 AND user_id = $2
       AND page_context->>'key' = $3
     ORDER BY created_at ASC
     LIMIT $4`,
    [containerId, userId, contextKey, limit],
  )

  return result.rows
}
