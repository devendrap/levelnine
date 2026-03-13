import { createSignal, Show, For, onMount } from 'solid-js'
import { useStore } from '@nanostores/solid'
import {
  $assistantMessages, $assistantStreaming, $assistantContext,
  $assistantSlug, $assistantOpen,
  type AssistantMessage, type PageContext,
} from '../../stores/assistant'
import { clean } from '../../lib/sanitize'

export default function AppAssistantPanel() {
  const messages = useStore($assistantMessages)
  const streaming = useStore($assistantStreaming)
  const context = useStore($assistantContext)
  const slug = useStore($assistantSlug)

  const [input, setInput] = createSignal('')
  let chatEnd: HTMLDivElement | undefined
  let inputRef: HTMLTextAreaElement | undefined

  const scrollToBottom = () => {
    setTimeout(() => chatEnd?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  // Load history on mount (MPA — context is stable per page)
  onMount(() => {
    const s = slug()
    if (s) loadHistory(s, context())
  })

  async function loadHistory(s: string, ctx: PageContext) {
    try {
      const params = new URLSearchParams({ page: ctx.page })
      if (ctx.entityType) params.set('entity_type', ctx.entityType)
      if (ctx.entityId) params.set('entity_id', ctx.entityId)

      const res = await fetch(`/api/v1/apps/${s}/assistant?${params}`)
      if (res.ok) {
        const data = await res.json()
        const loaded: AssistantMessage[] = (data.messages ?? []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content ?? '',
          toolCalls: m.tool_calls,
          toolResults: m.tool_results,
          createdAt: m.created_at,
        }))
        $assistantMessages.set(loaded)
        scrollToBottom()
      }
    } catch {
      // Ignore — fresh conversation
    }
  }

  async function sendMessage(overrideMsg?: string) {
    const msg = (overrideMsg ?? input()).trim()
    if (!msg || streaming()) return

    setInput('')
    $assistantStreaming.set(true)

    // Add user message
    const userMsg: AssistantMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: msg,
      createdAt: new Date().toISOString(),
    }
    $assistantMessages.set([...messages(), userMsg])
    scrollToBottom()

    // Add placeholder for assistant response
    const assistantId = crypto.randomUUID()
    const assistantMsg: AssistantMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      toolResults: [],
      createdAt: new Date().toISOString(),
    }
    $assistantMessages.set([...messages(), userMsg, assistantMsg])

    try {
      const res = await fetch(`/api/v1/apps/${slug()}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          page_context: context(),
          provider: 'ollama',
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        updateAssistantMessage(assistantId, `Error: ${err.error}`)
        $assistantStreaming.set(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        updateAssistantMessage(assistantId, 'Error: No response stream')
        $assistantStreaming.set(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let currentEvent = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7)
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6)
            try {
              const parsed = JSON.parse(data)
              handleSSEEvent(currentEvent, parsed, assistantId)
            } catch {
              // Skip malformed data
            }
          }
        }
      }
    } catch (err: any) {
      updateAssistantMessage(assistantId, `Error: ${err.message}`)
    } finally {
      $assistantStreaming.set(false)
      scrollToBottom()
    }
  }

  function handleSSEEvent(event: string, data: any, assistantId: string) {
    if (event === 'chunk') {
      // Append text chunk to the assistant message
      const msgs = $assistantMessages.get()
      const idx = msgs.findIndex(m => m.id === assistantId)
      if (idx >= 0) {
        const updated = [...msgs]
        updated[idx] = { ...updated[idx], content: updated[idx].content + (data.text ?? '') }
        $assistantMessages.set(updated)
      }
      scrollToBottom()
    } else if (event === 'tool_call') {
      // Show tool call indicator
      const msgs = $assistantMessages.get()
      const idx = msgs.findIndex(m => m.id === assistantId)
      if (idx >= 0) {
        const updated = [...msgs]
        const existing = updated[idx].toolResults ?? []
        updated[idx] = {
          ...updated[idx],
          toolResults: [...existing, { name: data.name, result: null, success: false }],
        }
        $assistantMessages.set(updated)
      }
    } else if (event === 'tool_result') {
      // Update tool result
      const msgs = $assistantMessages.get()
      const idx = msgs.findIndex(m => m.id === assistantId)
      if (idx >= 0) {
        const updated = [...msgs]
        const results = [...(updated[idx].toolResults ?? [])]
        const resultIdx = results.findIndex(r => r.name === data.name && !r.success)
        if (resultIdx >= 0) {
          results[resultIdx] = { name: data.name, result: data.result, success: data.success }
        } else {
          results.push({ name: data.name, result: data.result, success: data.success })
        }
        updated[idx] = { ...updated[idx], toolResults: results }
        $assistantMessages.set(updated)
      }
      scrollToBottom()
    } else if (event === 'error') {
      updateAssistantMessage(assistantId, `\n\nError: ${data.error}`)
    }
  }

  function updateAssistantMessage(id: string, appendText: string) {
    const msgs = $assistantMessages.get()
    const idx = msgs.findIndex(m => m.id === id)
    if (idx >= 0) {
      const updated = [...msgs]
      updated[idx] = { ...updated[idx], content: updated[idx].content + appendText }
      $assistantMessages.set(updated)
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Suggestions based on page context
  function getSuggestions(): string[] {
    const ctx = context()
    if (ctx.page === 'dashboard') {
      return ['What needs attention today?', 'Show me overdue items', 'Create a new record']
    }
    if (ctx.page === 'list') {
      return [`Create a new ${ctx.entityType?.replace(/_/g, ' ')}`, 'Which records need review?', 'Show workflow status summary']
    }
    if (ctx.page === 'detail') {
      return ['What fields am I missing?', "What's the next workflow step?", 'Help me fill this form']
    }
    if (ctx.page === 'new') {
      return ['Help me fill this form', 'What fields are required?', 'Suggest values for this record']
    }
    return ['How can I help?']
  }

  const contextLabel = () => {
    const ctx = context()
    if (ctx.page === 'dashboard') return 'Dashboard'
    if (ctx.page === 'list') return (ctx.entityType ?? '').replace(/_/g, ' ')
    if (ctx.page === 'detail') return (ctx.entityType ?? '').replace(/_/g, ' ')
    if (ctx.page === 'new') return `New ${(ctx.entityType ?? '').replace(/_/g, ' ')}`
    return ''
  }

  return (
    <div
      class="flex flex-col h-full"
      style={{ "background-color": "var(--ui-bg)" }}
    >
      {/* Header */}
      <div
        class="shrink-0 flex items-center justify-between px-4 py-3"
        style={{ "border-bottom": "1px solid var(--ui-border)" }}
      >
        <div class="flex items-center gap-2">
          <div
            class="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              "background": "linear-gradient(135deg, rgba(212,164,74,0.2) 0%, rgba(59,143,232,0.2) 100%)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ui-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
              <circle cx="12" cy="15" r="2" />
            </svg>
          </div>
          <div>
            <div class="text-xs font-semibold" style={{ color: "var(--ui-text)" }}>AI Assistant</div>
            <div class="text-[10px]" style={{ color: "var(--ui-text-placeholder)" }}>{contextLabel()}</div>
          </div>
        </div>
        <button
          onClick={() => $assistantOpen.set(false)}
          class="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer hover:opacity-80"
          style={{ color: "var(--ui-text-muted)" }}
          aria-label="Close assistant"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div class="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <Show when={messages().length === 0 && !streaming()}>
          <div class="text-center py-8">
            <div
              class="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
              style={{
                "background": "linear-gradient(135deg, rgba(212,164,74,0.1) 0%, rgba(59,143,232,0.1) 100%)",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ui-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p class="text-sm font-medium mb-1" style={{ color: "var(--ui-text)" }}>How can I help?</p>
            <p class="text-xs mb-4" style={{ color: "var(--ui-text-muted)" }}>
              Ask about workflows, fill forms, or create records.
            </p>
            <div class="flex flex-col gap-1.5">
              <For each={getSuggestions()}>
                {(suggestion) => (
                  <button
                    onClick={() => sendMessage(suggestion)}
                    class="text-left px-3 py-2 rounded-lg text-xs cursor-pointer hover:opacity-80 transition-opacity"
                    style={{
                      color: "var(--ui-text-muted)",
                      "background-color": "rgba(240,237,232,0.03)",
                      border: "1px solid var(--ui-border)",
                    }}
                  >
                    {suggestion}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        <For each={messages()}>
          {(msg) => (
            <Show when={msg.role === 'user' || msg.role === 'assistant'}>
              <div class="mb-3">
                {/* Role label */}
                <div class="flex items-center gap-1.5 mb-1">
                  <div
                    class="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold"
                    style={{
                      "background-color": msg.role === 'user' ? 'rgba(212,164,74,0.15)' : 'rgba(59,143,232,0.15)',
                      color: msg.role === 'user' ? 'var(--ui-primary)' : 'var(--ui-accent, #3B8FE8)',
                    }}
                  >
                    {msg.role === 'user' ? 'Y' : 'AI'}
                  </div>
                  <span class="text-[10px] font-medium" style={{ color: "var(--ui-text-muted)" }}>
                    {msg.role === 'user' ? 'You' : 'Assistant'}
                  </span>
                </div>

                {/* Content */}
                <div
                  class="text-xs leading-relaxed rounded-lg px-3 py-2.5"
                  style={{
                    "background-color": msg.role === 'user'
                      ? "rgba(212,164,74,0.06)"
                      : "rgba(240,237,232,0.02)",
                    border: msg.role === 'user'
                      ? "1px solid rgba(212,164,74,0.1)"
                      : "1px solid rgba(240,237,232,0.04)",
                    color: "var(--ui-text)",
                    "white-space": "pre-wrap",
                    "word-break": "break-word",
                  }}
                  innerHTML={msg.role === 'assistant' ? clean(formatMarkdown(msg.content)) : undefined}
                >
                  {msg.role === 'user' ? msg.content : undefined}
                </div>

                {/* Tool results */}
                <Show when={msg.toolResults?.length}>
                  <div class="mt-1.5 flex flex-col gap-1">
                    <For each={msg.toolResults}>
                      {(tr) => (
                        <div
                          class="text-[10px] px-2.5 py-1.5 rounded flex items-center gap-1.5"
                          style={{
                            "background-color": tr.success ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                            color: tr.success ? "var(--ui-success)" : "var(--ui-error)",
                            border: `1px solid ${tr.success ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                            <Show when={tr.success} fallback={<circle cx="12" cy="12" r="10" />}>
                              <polyline points="20 6 9 17 4 12" />
                            </Show>
                          </svg>
                          <span style={{ "font-weight": "500" }}>{tr.name.replace(/_/g, ' ')}</span>
                          <Show when={tr.result?.url}>
                            <a
                              href={tr.result.url}
                              class="underline"
                              style={{ color: "var(--ui-accent, #3B8FE8)" }}
                            >
                              {tr.result.label ?? 'Open'}
                            </a>
                          </Show>
                          <Show when={tr.result?.name}>
                            <span style={{ color: "var(--ui-text-muted)" }}>— {tr.result.name}</span>
                          </Show>
                          <Show when={tr.error}>
                            <span style={{ color: "var(--ui-error)" }}>— {tr.error}</span>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>
          )}
        </For>

        {/* Typing indicator */}
        <Show when={streaming()}>
          <div class="mb-3">
            <div class="flex items-center gap-1.5 mb-1">
              <div
                class="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold"
                style={{ "background-color": "rgba(59,143,232,0.15)", color: "var(--ui-accent, #3B8FE8)" }}
              >
                AI
              </div>
            </div>
            <div
              class="rounded-lg px-3 py-2.5"
              style={{ "background-color": "rgba(240,237,232,0.02)", border: "1px solid rgba(240,237,232,0.04)" }}
            >
              <div class="flex items-center gap-1">
                <div class="w-1.5 h-1.5 rounded-full animate-pulse" style={{ "background-color": "var(--ui-accent, #3B8FE8)" }} />
                <div class="w-1.5 h-1.5 rounded-full animate-pulse" style={{ "background-color": "var(--ui-accent, #3B8FE8)", "animation-delay": "0.15s" }} />
                <div class="w-1.5 h-1.5 rounded-full animate-pulse" style={{ "background-color": "var(--ui-accent, #3B8FE8)", "animation-delay": "0.3s" }} />
              </div>
            </div>
          </div>
        </Show>

        <div ref={chatEnd} />
      </div>

      {/* Input */}
      <div
        class="shrink-0 px-3 py-3"
        style={{ "border-top": "1px solid var(--ui-border)" }}
      >
        <div
          class="relative rounded-xl transition-all"
          style={{
            "background-color": "rgba(240,237,232,0.03)",
            border: input().trim()
              ? "1px solid rgba(212,164,74,0.35)"
              : "1px solid var(--ui-border)",
          }}
        >
          <textarea
            ref={(el) => {
              inputRef = el
              const resize = () => {
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 120) + 'px'
              }
              el.addEventListener('input', resize)
            }}
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            rows={1}
            class="w-full bg-transparent outline-none resize-none text-xs leading-relaxed px-3 pt-2.5 pb-8"
            style={{
              color: "var(--ui-text)",
              "min-height": "40px",
              "max-height": "120px",
              "font-family": "var(--ui-font)",
            }}
            disabled={streaming()}
          />
          <div class="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2.5 py-1.5">
            <span class="text-[9px]" style={{ color: "var(--ui-text-placeholder)" }}>
              <kbd class="px-1 py-0.5 rounded text-[8px]" style={{ "background-color": "rgba(240,237,232,0.06)", border: "1px solid rgba(240,237,232,0.08)" }}>Enter</kbd> send
            </span>
            <button
              onClick={() => sendMessage()}
              disabled={streaming() || !input().trim()}
              class="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer transition-all disabled:opacity-20"
              style={{
                "background": input().trim()
                  ? "linear-gradient(135deg, var(--ui-primary) 0%, var(--ui-primary-hover) 100%)"
                  : "rgba(240,237,232,0.06)",
              }}
              aria-label="Send message"
            >
              <svg
                width="12" height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke={input().trim() ? "var(--ui-text-on-primary)" : "var(--ui-text-muted)"}
                stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Simple markdown → HTML (bold, italic, code, links, lists) */
function formatMarkdown(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(240,237,232,0.08);padding:1px 4px;border-radius:3px;font-size:11px">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:var(--ui-accent,#3B8FE8);text-decoration:underline">$1</a>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:16px;list-style:disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li style="margin-left:16px;list-style:decimal">$2</li>')
    .replace(/\n/g, '<br>')
}
