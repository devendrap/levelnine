import { createSignal, Show, For, onMount } from 'solid-js'
import { SchemaPreviewPanel } from '../SchemaPreviewPanel'
import { parseMessageSegments, parseEntityTypesFromMessage } from '../../lib/containers/parser'
import type { Message, MessageSegment } from '../../lib/containers/types'

export default function ChatPanel(props: {
  containerId: string
  containerStatus: string
  initialMessages: Message[]
  /** Pre-fill input (e.g. from ?enhance= param) */
  initialInput?: string
  /** Auto-send on mount (e.g. from ?action=generate-schemas) */
  autoSend?: string
}) {
  const [messages, setMessages] = createSignal<Message[]>(props.initialMessages)
  const [input, setInput] = createSignal(props.initialInput ?? '')
  const [sending, setSending] = createSignal(false)
  const [savingAll, setSavingAll] = createSignal(false)
  let chatEnd: HTMLDivElement | undefined
  let inputRef: HTMLTextAreaElement | undefined

  const provider = () => {
    const el = document.getElementById('provider-select') as HTMLSelectElement | null
    return el?.value ?? 'ollama'
  }

  const scrollToBottom = () => {
    setTimeout(() => chatEnd?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  onMount(() => {
    scrollToBottom()
    if (props.autoSend) sendMessage(props.autoSend)
    else if (props.initialInput) inputRef?.focus()
  })

  const sendMessage = async (overrideMsg?: string) => {
    const msg = (overrideMsg ?? input()).trim()
    if (!msg || sending()) return

    setInput('')
    setSending(true)

    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'user',
      content: msg,
      created_at: new Date().toISOString(),
    }])
    scrollToBottom()

    try {
      const res = await fetch(`/api/v1/containers/${props.containerId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, provider: provider() }),
      })

      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply,
          created_at: new Date().toISOString(),
        }])
      } else {
        const err = await res.json()
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Error: ${err.error}`,
          created_at: new Date().toISOString(),
        }])
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${e.message}`,
        created_at: new Date().toISOString(),
      }])
    } finally {
      setSending(false)
      scrollToBottom()
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const saveAllFromMessages = async () => {
    setSavingAll(true)
    try {
      const allParsed: any[] = []
      for (const msg of messages()) {
        if (msg.role !== 'assistant') continue
        const parsed = parseEntityTypesFromMessage(msg.content)
        for (const et of parsed) {
          const existing = allParsed.findIndex(e => e.name === et.name)
          if (existing >= 0) allParsed[existing] = { ...allParsed[existing], ...et }
          else allParsed.push(et)
        }
      }

      if (allParsed.length === 0) {
        alert('No entity types found in conversation. Ask the AI to generate entity types.')
        return
      }

      const res = await fetch(`/api/v1/containers/${props.containerId}/entity-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_types: allParsed }),
      })

      if (res.ok) {
        window.location.href = `/containers/${props.containerId}?tab=manifest`
      } else {
        const err = await res.json()
        alert(`Save failed: ${err.error}`)
      }
    } finally {
      setSavingAll(false)
    }
  }

  return (
    <>
      {/* Messages */}
      <div class="flex-1 overflow-y-auto">
        <div class="max-w-4xl mx-auto px-6 py-6">
          <Show when={messages().length === 0}>
            <div class="text-center py-16">
              <p class="text-base font-medium mb-2" style={{ color: "var(--ui-text)" }}>
                What industry are we building for?
              </p>
              <p class="text-sm mb-8" style={{ color: "var(--ui-text-muted)" }}>
                Describe the domain and I'll design a complete application structure.
              </p>
              <div class="grid grid-cols-2 gap-2 max-w-lg mx-auto">
                <For each={[
                  "PCAOB financial audit for public companies",
                  "Trucking owner-operator management",
                  "Tax return preparation workflow",
                  "Construction project management",
                ]}>
                  {(suggestion) => (
                    <button
                      onClick={() => sendMessage(suggestion)}
                      class="px-4 py-3 rounded-lg text-xs text-left border cursor-pointer hover:opacity-80 transition-opacity"
                      style={{
                        "border-color": "var(--ui-border)",
                        color: "var(--ui-text-muted)",
                        "background-color": "rgba(240,237,232,0.02)",
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
              <div class="mb-5">
                {/* Message header */}
                <div class="flex items-center gap-2.5 mb-2">
                  <div
                    class="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold"
                    style={{
                      "background-color": msg.role === 'user' ? 'rgba(212,164,74,0.15)' : 'rgba(59,143,232,0.15)',
                      color: msg.role === 'user' ? 'var(--ui-primary)' : 'var(--ui-accent, #3B8FE8)',
                    }}
                  >
                    {msg.role === 'user' ? 'Y' : 'AI'}
                  </div>
                  <span class="text-xs font-medium" style={{ color: "var(--ui-text-muted)" }}>
                    {msg.role === 'user' ? 'You' : 'Assistant'}
                  </span>
                  <span class="text-[10px]" style={{ color: "rgba(240,237,232,0.25)" }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Message body */}
                <Show when={msg.role === 'user'}>
                  <div
                    class="text-sm leading-relaxed rounded-xl px-5 py-4"
                    style={{
                      "background-color": "rgba(212,164,74,0.06)",
                      border: "1px solid rgba(212,164,74,0.1)",
                      color: "var(--ui-text)",
                    }}
                  >
                    <span style={{ "white-space": "pre-wrap" }}>{msg.content}</span>
                  </div>
                </Show>
                <Show when={msg.role === 'assistant'}>
                  <div
                    class="text-sm leading-relaxed rounded-xl px-5 py-4"
                    style={{
                      "background-color": "rgba(240,237,232,0.02)",
                      border: "1px solid rgba(240,237,232,0.04)",
                      color: "var(--ui-text)",
                    }}
                  >
                    <For each={parseMessageSegments(msg.content)}>
                      {(seg) => (
                        <>
                          <Show when={seg.kind === 'html'}>
                            <div innerHTML={(seg as any).html} />
                          </Show>
                          <Show when={seg.kind === 'schema'}>
                            <div class="my-3">
                              <SchemaPreviewPanel
                                name={(seg as Extract<MessageSegment, { kind: 'schema' }>).name}
                                schema={(seg as Extract<MessageSegment, { kind: 'schema' }>).schema}
                                defaultMode="preview"
                              />
                            </div>
                          </Show>
                          <Show when={seg.kind === 'meta'}>
                            <div class="cm-meta-block">
                              <span>Entity types summary — click "Save All to Manifest" to apply</span>
                            </div>
                          </Show>
                        </>
                      )}
                    </For>
                  </div>
                </Show>

                {/* Save button */}
                <Show when={msg.role === 'assistant' && props.containerStatus !== 'locked'}>
                  <div class="flex items-center gap-2 mt-2 ml-8">
                    <button
                      onClick={saveAllFromMessages}
                      disabled={savingAll()}
                      class="px-3 py-1.5 rounded-md text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-40"
                      style={{
                        "background-color": "rgba(212,164,74,0.08)",
                        color: "var(--ui-primary)",
                        border: "1px solid rgba(212,164,74,0.12)",
                      }}
                    >
                      {savingAll() ? 'Saving...' : 'Save All to Manifest'}
                    </button>
                  </div>
                </Show>
              </div>
            )}
          </For>

          {/* Typing indicator */}
          <Show when={sending()}>
            <div class="mb-5">
              <div class="flex items-center gap-2.5 mb-2">
                <div
                  class="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold"
                  style={{ "background-color": "rgba(59,143,232,0.15)", color: "var(--ui-accent, #3B8FE8)" }}
                >
                  AI
                </div>
                <span class="text-xs font-medium" style={{ color: "var(--ui-text-muted)" }}>Assistant</span>
              </div>
              <div
                class="rounded-xl px-5 py-4"
                style={{ "background-color": "rgba(240,237,232,0.02)", border: "1px solid rgba(240,237,232,0.04)" }}
              >
                <div class="flex items-center gap-1.5">
                  <div class="w-2 h-2 rounded-full animate-pulse" style={{ "background-color": "var(--ui-accent, #3B8FE8)" }} />
                  <div class="w-2 h-2 rounded-full animate-pulse" style={{ "background-color": "var(--ui-accent, #3B8FE8)", "animation-delay": "0.15s" }} />
                  <div class="w-2 h-2 rounded-full animate-pulse" style={{ "background-color": "var(--ui-accent, #3B8FE8)", "animation-delay": "0.3s" }} />
                  <span class="text-xs ml-2" style={{ color: "var(--ui-text-muted)" }}>Generating...</span>
                </div>
              </div>
            </div>
          </Show>

          <div ref={chatEnd} />
        </div>
      </div>

      {/* Input area */}
      <div class="shrink-0 border-t" style={{ "border-color": "var(--ui-border)", "background-color": "rgba(11,15,26,0.4)" }}>
        <Show when={props.containerStatus !== 'locked'}
          fallback={
            <div class="text-center py-4">
              <span class="text-xs" style={{ color: "var(--ui-text-muted)" }}>
                Container is locked — no further modifications allowed.
              </span>
            </div>
          }
        >
          <div class="max-w-4xl mx-auto px-6 py-4">
            <div
              class="flex items-end gap-3 rounded-xl border px-4 py-3"
              style={{ "background-color": "rgba(240,237,232,0.02)", "border-color": "var(--ui-border)" }}
            >
              <textarea
                ref={inputRef}
                value={input()}
                onInput={(e) => setInput(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your industry, refine schemas, or ask for specific entity types..."
                rows={1}
                class="flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed"
                style={{ color: "var(--ui-text)", "min-height": "24px", "max-height": "120px" }}
                disabled={sending()}
              />
              <button
                onClick={() => sendMessage()}
                disabled={sending() || !input().trim()}
                class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all disabled:opacity-30"
                style={{ "background-color": "var(--ui-primary)" }}
              >
                <span style={{ color: "#0B0F1A", "font-size": "14px", "font-weight": "bold" }}>&uarr;</span>
              </button>
            </div>
          </div>
        </Show>
      </div>
    </>
  )
}
