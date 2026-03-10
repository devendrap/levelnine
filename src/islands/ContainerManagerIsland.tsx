import { createSignal, createResource, createMemo, Show, For, onCleanup, ErrorBoundary } from 'solid-js'
import type { JSX } from 'solid-js'
import { Renderer } from '../renderer/Renderer'
import { SchemaPreviewPanel } from '../components/SchemaPreviewPanel'

// ============================================================================
// Dialog system — replaces alert() and confirm()
// ============================================================================

interface DialogState {
  title: string
  message: string
  variant: 'confirm' | 'alert' | 'error'
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

function createDialogSystem() {
  const [dialog, setDialog] = createSignal<DialogState | null>(null)

  function showConfirm(opts: { title: string; message: string; confirmLabel?: string; variant?: 'confirm' | 'error' }): Promise<boolean> {
    return new Promise((resolve) => {
      setDialog({
        title: opts.title,
        message: opts.message,
        variant: opts.variant ?? 'confirm',
        confirmLabel: opts.confirmLabel ?? 'Confirm',
        cancelLabel: 'Cancel',
        onConfirm: () => { setDialog(null); resolve(true) },
        onCancel: () => { setDialog(null); resolve(false) },
      })
    })
  }

  function showAlert(opts: { title: string; message: string; variant?: 'alert' | 'error' }): Promise<void> {
    return new Promise((resolve) => {
      setDialog({
        title: opts.title,
        message: opts.message,
        variant: opts.variant ?? 'alert',
        confirmLabel: 'OK',
        onConfirm: () => { setDialog(null); resolve() },
        onCancel: () => { setDialog(null); resolve() },
      })
    })
  }

  function DialogOverlay(): JSX.Element {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dialog()) dialog()!.onCancel()
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', onKeyDown)
      onCleanup(() => document.removeEventListener('keydown', onKeyDown))
    }

    const variantColors = (v: string) => {
      switch (v) {
        case 'error': return { icon: '#EF4444', iconBg: 'rgba(239,68,68,0.1)', btn: '#EF4444' }
        case 'confirm': return { icon: 'var(--ui-primary)', iconBg: 'rgba(212,164,74,0.1)', btn: 'var(--ui-primary)' }
        default: return { icon: 'var(--ui-accent, #3B8FE8)', iconBg: 'rgba(59,143,232,0.1)', btn: 'var(--ui-accent, #3B8FE8)' }
      }
    }

    return (
      <Show when={dialog()}>
        {(d) => {
          const vc = () => variantColors(d().variant)
          return (
            <div
              class="fixed inset-0 z-50 flex items-center justify-center"
              style={{ "background-color": "rgba(0,0,0,0.6)", "backdrop-filter": "blur(4px)" }}
              onClick={(e) => { if (e.target === e.currentTarget) d().onCancel() }}
            >
              <div
                class="rounded-xl border p-6 w-full max-w-sm mx-4"
                style={{
                  "background-color": "var(--ui-card-bg, #131720)",
                  "border-color": "var(--ui-border)",
                  "box-shadow": "0 25px 50px -12px rgba(0,0,0,0.5)",
                }}
                role="dialog"
                aria-modal="true"
              >
                {/* Icon */}
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ "background-color": vc().iconBg }}
                >
                  <Show when={d().variant === 'error'}>
                    <span style={{ color: vc().icon, "font-size": "18px" }}>!</span>
                  </Show>
                  <Show when={d().variant === 'confirm'}>
                    <span style={{ color: vc().icon, "font-size": "18px" }}>?</span>
                  </Show>
                  <Show when={d().variant === 'alert'}>
                    <span style={{ color: vc().icon, "font-size": "18px" }}>i</span>
                  </Show>
                </div>

                {/* Title */}
                <h3 class="text-sm font-semibold mb-1.5" style={{ color: "var(--ui-text)" }}>
                  {d().title}
                </h3>

                {/* Message */}
                <p class="text-xs leading-relaxed mb-5" style={{ color: "var(--ui-text-muted)" }}>
                  {d().message}
                </p>

                {/* Actions */}
                <div class="flex items-center gap-2 justify-end">
                  <Show when={d().variant === 'confirm' || d().variant === 'error'}>
                    <button
                      onClick={d().onCancel}
                      class="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-opacity hover:opacity-80"
                      style={{
                        "background-color": "rgba(240,237,232,0.06)",
                        color: "var(--ui-text-muted)",
                      }}
                    >
                      {d().cancelLabel}
                    </button>
                  </Show>
                  <button
                    onClick={d().onConfirm}
                    class="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-opacity hover:opacity-90"
                    style={{
                      "background-color": d().variant === 'error' ? 'rgba(239,68,68,0.15)' : vc().btn,
                      color: d().variant === 'error' ? '#EF4444' : (d().variant === 'confirm' ? '#0B0F1A' : '#fff'),
                    }}
                  >
                    {d().confirmLabel}
                  </button>
                </div>
              </div>
            </div>
          )
        }}
      </Show>
    )
  }

  return { showConfirm, showAlert, DialogOverlay }
}

// ============================================================================
// Types
// ============================================================================

interface Container {
  id: string
  name: string
  description: string | null
  status: 'draft' | 'review' | 'locked'
  manifest: ContainerManifest
  created_at: string
  updated_at: string
}

interface ContainerManifest {
  entity_types?: EntityTypeDef[]
  navigation?: Array<{ label: string; children: string[] }>
}

interface EntityTypeDef {
  name: string
  description: string
  schema: Record<string, any> | null
  key_fields?: string[]
  reviewed?: boolean
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

// ============================================================================
// Data fetching
// ============================================================================

async function fetchContainers(): Promise<Container[]> {
  const res = await fetch('/api/v1/containers')
  if (!res.ok) return []
  return res.json()
}

// ============================================================================
// Entity type parser — extract from AI messages
// ============================================================================

function parseEntityTypesFromMessage(content: string): EntityTypeDef[] {
  // Look for the structured ```json:entity_types block the AI is instructed to output
  const summaryMatch = content.match(/```json:entity_types\n([\s\S]*?)```/)
  if (summaryMatch) {
    try {
      const parsed = JSON.parse(summaryMatch[1].trim())
      if (Array.isArray(parsed)) {
        return parsed
          .filter((e: any) => e.name && e.description)
          .map((e: any) => ({
            name: e.name,
            description: e.description,
            schema: e.schema ?? null,
            key_fields: e.key_fields,
          }))
      }
    } catch { /* fall through to legacy parsing */ }
  }

  // Fallback: look for regular ```json blocks that might be schemas
  const entityTypes: EntityTypeDef[] = []
  const blockRegex = /```json\n([\s\S]*?)```/g
  let match
  while ((match = blockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      // If it's an array of entity type objects
      if (Array.isArray(parsed) && parsed[0]?.name && parsed[0]?.description) {
        for (const e of parsed) {
          entityTypes.push({
            name: e.name,
            description: e.description,
            schema: e.schema ?? null,
            key_fields: e.key_fields,
          })
        }
        continue
      }
      // If it's a single schema (Container type)
      if (parsed.type === 'Container' && parsed.children) {
        const heading = parsed.children.find((c: any) => c.type === 'Heading')
        if (heading?.props?.text) {
          const name = heading.props.text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
          entityTypes.push({
            name,
            description: heading.props.text,
            schema: parsed,
          })
        }
      }
    } catch { /* skip invalid JSON */ }
  }

  return entityTypes
}

// ============================================================================
// Markdown renderer
// ============================================================================

function renderMarkdown(text: string): string {
  return text
    // Hide the machine-readable entity_types summary block — data is consumed via Save All
    .replace(/```json:entity_types\n[\s\S]*?```/g,
      '<div class="cm-meta-block"><span>Entity types summary — click "Save All to Manifest" to apply</span></div>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
      `<pre class="cm-codeblock"><code>${escapeHtml(code.trim())}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code class="cm-inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#### (.+)$/gm, '<h4 class="cm-h4">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="cm-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="cm-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="cm-h1">$1</h1>')
    .replace(/^---$/gm, '<hr class="cm-hr"/>')
    .replace(/^- (.+)$/gm, '<li class="cm-li-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="cm-li-num">$1</li>')
    .replace(/\n\n/g, '</p><p class="cm-p">')
    .replace(/\n/g, '<br/>')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ============================================================================
// Message segment parser — splits assistant message into text + schema blocks
// ============================================================================

type MessageSegment =
  | { kind: 'html'; html: string }
  | { kind: 'schema'; name: string; description: string; schema: Record<string, any> }
  | { kind: 'meta' }  // entity_types summary block — hidden

function parseMessageSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = []
  // Match both ```json:entity_types and ```json blocks
  const blockRegex = /```(json:entity_types|json)\n([\s\S]*?)```/g
  let lastIndex = 0
  let match

  while ((match = blockRegex.exec(content)) !== null) {
    // Text before this block
    const before = content.slice(lastIndex, match.index)
    if (before.trim()) {
      segments.push({ kind: 'html', html: renderMarkdownSegment(before) })
    }

    const tag = match[1]
    const raw = match[2].trim()

    if (tag === 'json:entity_types') {
      // Hidden summary block
      segments.push({ kind: 'meta' })
    } else {
      // Try to parse as a renderable schema
      try {
        const parsed = JSON.parse(raw)
        if (parsed.type && parsed.props) {
          // Single component schema — derive name from Heading child or type
          const heading = parsed.children?.find?.((c: any) => c.type === 'Heading')
          const name = heading?.props?.text ?? parsed.type
          segments.push({ kind: 'schema', name, description: name, schema: parsed })
        } else if (Array.isArray(parsed) && parsed[0]?.name && parsed[0]?.schema) {
          // Array of entity types with schemas — each becomes a block
          for (const et of parsed) {
            if (et.schema) {
              segments.push({ kind: 'schema', name: et.name, description: et.description ?? et.name, schema: et.schema })
            }
          }
        } else {
          // Not a renderable schema — show as code
          segments.push({ kind: 'html', html: `<pre class="cm-codeblock"><code>${escapeHtml(raw)}</code></pre>` })
        }
      } catch {
        segments.push({ kind: 'html', html: `<pre class="cm-codeblock"><code>${escapeHtml(raw)}</code></pre>` })
      }
    }

    lastIndex = match.index + match[0].length
  }

  // Remaining text after last block
  const after = content.slice(lastIndex)
  if (after.trim()) {
    segments.push({ kind: 'html', html: renderMarkdownSegment(after) })
  }

  return segments
}

/** Render markdown for a text segment (no json block handling needed) */
function renderMarkdownSegment(text: string): string {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
      `<pre class="cm-codeblock"><code>${escapeHtml(code.trim())}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code class="cm-inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#### (.+)$/gm, '<h4 class="cm-h4">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="cm-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="cm-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="cm-h1">$1</h1>')
    .replace(/^---$/gm, '<hr class="cm-hr"/>')
    .replace(/^- (.+)$/gm, '<li class="cm-li-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="cm-li-num">$1</li>')
    .replace(/\n\n/g, '</p><p class="cm-p">')
    .replace(/\n/g, '<br/>')
}

// ============================================================================
// Styles (injected once)
// ============================================================================

const STYLES = `
.cm-codeblock{background:rgba(0,0,0,0.35);border:1px solid rgba(212,164,74,0.1);border-radius:8px;padding:14px 16px;overflow-x:auto;overflow-y:auto;max-height:400px;margin:10px 0;font-family:var(--ui-font-mono,"Space Mono",monospace);font-size:12px;line-height:1.6;color:#F0EDE8}
.cm-inline-code{background:rgba(0,0,0,0.25);padding:2px 7px;border-radius:4px;font-family:var(--ui-font-mono,"Space Mono",monospace);font-size:12px;color:var(--ui-primary,#D4A44A)}
.cm-h1{font-weight:700;font-size:18px;margin:20px 0 8px;color:var(--ui-text,#F0EDE8)}
.cm-h2{font-weight:700;font-size:16px;margin:18px 0 6px;color:var(--ui-text,#F0EDE8)}
.cm-h3{font-weight:600;font-size:14px;margin:14px 0 4px;color:var(--ui-text,#F0EDE8)}
.cm-h4{font-weight:600;font-size:13px;margin:12px 0 4px;color:var(--ui-text-muted)}
.cm-hr{border:none;border-top:1px solid rgba(212,164,74,0.15);margin:16px 0}
.cm-li-disc{margin-left:20px;list-style:disc;padding:1px 0}
.cm-li-num{margin-left:20px;list-style:decimal;padding:1px 0}
.cm-p{margin:6px 0}
.cm-meta-block{background:rgba(212,164,74,0.06);border:1px dashed rgba(212,164,74,0.2);border-radius:8px;padding:10px 14px;margin:10px 0;font-size:11px;color:var(--ui-primary,#D4A44A)}
`

// ============================================================================
// Component
// ============================================================================

export default function ContainerManagerIsland() {
  // Inject styles once
  if (typeof document !== 'undefined' && !document.getElementById('cm-styles')) {
    const style = document.createElement('style')
    style.id = 'cm-styles'
    style.textContent = STYLES
    document.head.appendChild(style)
  }

  const { showConfirm, showAlert, DialogOverlay } = createDialogSystem()

  const [containers, { refetch }] = createResource(fetchContainers)
  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  const [container, setContainer] = createSignal<Container | null>(null)
  const [messages, setMessages] = createSignal<Message[]>([])
  const [input, setInput] = createSignal('')
  const [sending, setSending] = createSignal(false)
  const [creating, setCreating] = createSignal(false)
  const [newName, setNewName] = createSignal('')
  const [provider, setProvider] = createSignal('ollama')
  const [savingAll, setSavingAll] = createSignal(false)
  const [activeTab, setActiveTab] = createSignal<'chat' | 'manifest'>('chat')
  let chatEnd: HTMLDivElement | undefined
  let inputRef: HTMLTextAreaElement | undefined

  // Derived: entity types from manifest
  const entityTypes = createMemo(() => container()?.manifest?.entity_types ?? [])
  const reviewedCount = createMemo(() => entityTypes().filter(e => e.reviewed).length)
  const totalCount = createMemo(() => entityTypes().length)
  const allReviewed = createMemo(() => totalCount() > 0 && reviewedCount() === totalCount())

  const scrollToBottom = () => {
    setTimeout(() => chatEnd?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  // ---- Container operations ----

  const selectContainer = async (id: string) => {
    setSelectedId(id)
    setActiveTab('chat')
    const res = await fetch(`/api/v1/containers/${id}`)
    if (res.ok) {
      const data = await res.json()
      setContainer(data.container)
      setMessages(data.messages)
      scrollToBottom()
    }
  }

  const createContainer = async () => {
    const name = newName().trim()
    if (!name) return
    const res = await fetch('/api/v1/containers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const c = await res.json()
      setNewName('')
      setCreating(false)
      refetch()
      selectContainer(c.id)
    }
  }

  const removeContainer = async (id?: string) => {
    const targetId = id ?? selectedId()
    if (!targetId) return
    const targetName = (containers() ?? []).find(c => c.id === targetId)?.name ?? 'this container'
    const ok = await showConfirm({
      title: `Delete "${targetName}"`,
      message: 'This will permanently delete the container and all its chat history. This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'error',
    })
    if (!ok) return
    const res = await fetch(`/api/v1/containers/${targetId}`, { method: 'DELETE' })
    if (res.ok) {
      if (selectedId() === targetId) {
        setSelectedId(null)
        setContainer(null)
        setMessages([])
      }
      refetch()
    }
  }

  // ---- Chat ----

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
      const res = await fetch(`/api/v1/containers/${selectedId()}/chat`, {
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
        setContainer(data.container)
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

  // ---- Manifest operations ----

  const saveAllFromMessages = async () => {
    setSavingAll(true)
    try {
      // Parse entity types from all assistant messages
      const allParsed: EntityTypeDef[] = []
      for (const msg of messages()) {
        if (msg.role !== 'assistant') continue
        const parsed = parseEntityTypesFromMessage(msg.content)
        for (const et of parsed) {
          const existing = allParsed.findIndex(e => e.name === et.name)
          if (existing >= 0) {
            allParsed[existing] = { ...allParsed[existing], ...et }
          } else {
            allParsed.push(et)
          }
        }
      }

      if (allParsed.length === 0) {
        await showAlert({
          title: 'No Entity Types Found',
          message: 'Could not parse entity types from the conversation. Ask the AI to generate entity types — it should include a structured JSON summary block at the end of its response.',
        })
        return
      }

      const res = await fetch(`/api/v1/containers/${selectedId()}/entity-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_types: allParsed }),
      })

      if (res.ok) {
        const updated = await res.json()
        setContainer(updated)
        refetch()
        setActiveTab('manifest')
      } else {
        const err = await res.json()
        await showAlert({ title: 'Save Failed', message: err.error, variant: 'error' })
      }
    } finally {
      setSavingAll(false)
    }
  }

  const reviewEntityType = async (name: string) => {
    const res = await fetch(`/api/v1/containers/${selectedId()}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names: [name] }),
    })
    if (res.ok) {
      const updated = await res.json()
      setContainer(updated)
      refetch()
    } else {
      const err = await res.json()
      await showAlert({ title: 'Review Failed', message: err.error, variant: 'error' })
    }
  }

  const unlockEntityType = async (name: string) => {
    const res = await fetch(`/api/v1/containers/${selectedId()}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const updated = await res.json()
      setContainer(updated)
      refetch()
    }
  }

  const removeEntityType = async (name: string) => {
    const ok = await showConfirm({
      title: 'Remove Entity Type',
      message: `Remove "${name}" from the manifest? This won't affect any existing data.`,
      confirmLabel: 'Remove',
      variant: 'error',
    })
    if (!ok) return
    const res = await fetch(`/api/v1/containers/${selectedId()}/entity-types`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names: [name] }),
    })
    if (res.ok) {
      const updated = await res.json()
      setContainer(updated)
      refetch()
    } else {
      const err = await res.json()
      await showAlert({ title: 'Remove Failed', message: err.error, variant: 'error' })
    }
  }

  const enhanceEntityType = (name: string) => {
    setActiveTab('chat')
    const msg = `Generate the full detailed JSON schema for "${name}". Include every field a practitioner would need, use appropriate ai-ui components (Tabs for sections, Select for dropdowns, DatePicker for dates, FileUpload for documents, RichText for notes). Make it production-ready.`
    setInput(msg)
    inputRef?.focus()
  }

  const generateAllSchemas = async () => {
    const missing = entityTypes().filter(et => !et.schema)
    if (missing.length === 0) {
      await showAlert({ title: 'All Done', message: 'Every entity type already has a schema.' })
      return
    }

    setActiveTab('chat')
    const batchSize = 3
    const batch = missing.slice(0, batchSize)
    const names = batch.map(e => e.name)
    const msg = `Generate full JSON schemas for these ${batch.length} entity types: ${names.join(', ')}

For each, use appropriate ai-ui components (Tabs, Select, DatePicker, FileUpload, RichText, Table, Checkbox). Be thorough but concise.

IMPORTANT: In the json:entity_types summary block at the end, include ONLY these ${batch.length} entity types with their schemas. Do NOT include the other ${entityTypes().length - batch.length} entity types.`
    sendMessage(msg)
  }

  const lockContainer = async () => {
    const ok = await showConfirm({
      title: 'Lock Container',
      message: `This will lock the container and deploy all ${totalCount()} entity types to the database. No further modifications will be possible. Are you sure?`,
      confirmLabel: 'Lock & Deploy',
    })
    if (!ok) return
    const res = await fetch(`/api/v1/containers/${selectedId()}/lock`, {
      method: 'POST',
    })
    if (res.ok) {
      const updated = await res.json()
      setContainer(updated)
      refetch()
    } else {
      const err = await res.json()
      await showAlert({ title: 'Lock Failed', message: err.error, variant: 'error' })
    }
  }

  // ---- Navigation ----

  const goBack = () => {
    if ('navigate' in window) {
      (window as any).navigate('/dashboard')
    } else {
      window.location.href = '/dashboard'
    }
  }

  // ---- Render helpers ----

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; fg: string }> = {
      draft: { bg: 'rgba(240,237,232,0.08)', fg: 'var(--ui-text-muted)' },
      review: { bg: 'rgba(228,168,50,0.12)', fg: '#E4A832' },
      locked: { bg: 'rgba(34,197,94,0.12)', fg: '#22C55E' },
    }
    const c = colors[status] ?? colors.draft
    return { "background-color": c.bg, color: c.fg }
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div
      class="dark flex h-screen"
      style={{ "background-color": "var(--ui-bg)", "font-family": "var(--ui-font)" }}
    >
      {/* ---- Sidebar ---- */}
      <aside
        class="w-80 flex flex-col border-r shrink-0"
        style={{ "background-color": "rgba(11,15,26,0.6)", "border-color": "var(--ui-border)" }}
      >
        {/* Sidebar header */}
        <div
          class="flex items-center justify-between px-5 py-4 border-b"
          style={{ "border-color": "var(--ui-border)" }}
        >
          <div class="flex items-center gap-3">
            <button
              onClick={goBack}
              class="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
              style={{ "background-color": "rgba(240,237,232,0.06)" }}
              title="Back to Dashboard"
            >
              <span style={{ color: "var(--ui-text-muted)", "font-size": "14px" }}>&larr;</span>
            </button>
            <div>
              <h2 class="text-sm font-semibold tracking-tight" style={{ color: "var(--ui-text)" }}>
                Containers
              </h2>
              <p class="text-[10px]" style={{ color: "var(--ui-text-muted)" }}>
                Industry definitions
              </p>
            </div>
          </div>
        </div>

        {/* Container list */}
        <div class="flex-1 overflow-y-auto px-3 py-2">
          <For each={containers() ?? []}>
            {(c) => {
              const [hovered, setHovered] = createSignal(false)
              return (
              <div
                onClick={() => selectContainer(c.id)}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                class="w-full text-left px-3 py-3 rounded-lg mb-1 cursor-pointer transition-all"
                style={{
                  "background-color": selectedId() === c.id
                    ? 'rgba(212,164,74,0.08)'
                    : 'transparent',
                  "border-left": selectedId() === c.id
                    ? '2px solid var(--ui-primary)'
                    : '2px solid transparent',
                }}
              >
                <div class="flex items-center justify-between mb-0.5">
                  <span
                    class="text-sm font-medium truncate"
                    style={{ color: selectedId() === c.id ? 'var(--ui-text)' : 'var(--ui-text-muted)' }}
                  >
                    {c.name}
                  </span>
                  <div class="flex items-center gap-1.5">
                    <Show when={hovered() && c.status !== 'locked'}>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeContainer(c.id) }}
                        class="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:opacity-80"
                        style={{ "background-color": "rgba(239,68,68,0.12)" }}
                        title={`Delete ${c.name}`}
                      >
                        <svg viewBox="0 0 16 16" fill="none" style={{ width: "16px", height: "16px" }}>
                          <path d="M4 4l8 8M12 4l-8 8" stroke="#EF4444" stroke-width="2" stroke-linecap="round" />
                        </svg>
                      </button>
                    </Show>
                    <span
                      class="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded"
                      style={statusBadge(c.status)}
                    >
                      {c.status}
                    </span>
                  </div>
                </div>
                <Show when={c.manifest?.entity_types?.length}>
                  <div class="flex items-center gap-1.5 mt-1">
                    <div
                      class="h-1 rounded-full flex-1"
                      style={{ "background-color": "rgba(240,237,232,0.06)" }}
                    >
                      <div
                        class="h-1 rounded-full transition-all"
                        style={{
                          "background-color": "var(--ui-primary)",
                          width: `${((c.manifest.entity_types!.filter(e => e.reviewed).length / c.manifest.entity_types!.length) * 100)}%`,
                        }}
                      />
                    </div>
                    <span class="text-[10px] tabular-nums" style={{ color: "var(--ui-text-muted)" }}>
                      {c.manifest.entity_types!.filter(e => e.reviewed).length}/{c.manifest.entity_types!.length}
                    </span>
                  </div>
                </Show>
              </div>
              )
            }}
          </For>

          <Show when={creating()}>
            <div class="px-2 py-2 mt-1">
              <input
                type="text"
                value={newName()}
                onInput={(e) => setNewName(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && createContainer()}
                placeholder="Container name..."
                class="w-full px-3 py-2.5 rounded-lg text-sm border outline-none"
                style={{
                  "background-color": "rgba(240,237,232,0.04)",
                  "border-color": "var(--ui-border)",
                  color: "var(--ui-text)",
                }}
                autofocus
              />
              <div class="flex gap-2 mt-2">
                <button
                  onClick={createContainer}
                  class="flex-1 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                  style={{ "background-color": "var(--ui-primary)", color: "#0B0F1A" }}
                >
                  Create
                </button>
                <button
                  onClick={() => setCreating(false)}
                  class="flex-1 px-3 py-2 rounded-lg text-xs cursor-pointer"
                  style={{ color: "var(--ui-text-muted)", "background-color": "rgba(240,237,232,0.04)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </Show>
        </div>

        {/* Sidebar footer actions */}
        <div class="px-3 py-3 border-t space-y-2" style={{ "border-color": "var(--ui-border)" }}>
          <button
            onClick={() => setCreating(true)}
            class="w-full px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all hover:opacity-90"
            style={{
              "background-color": "rgba(212,164,74,0.08)",
              color: "var(--ui-primary)",
              border: "1px solid rgba(212,164,74,0.15)",
            }}
          >
            + New Container
          </button>
        </div>
      </aside>

      {/* ---- Main area ---- */}
      <main class="flex-1 flex flex-col min-w-0">
        <Show
          when={selectedId()}
          fallback={
            <div class="flex-1 flex items-center justify-center">
              <div class="text-center max-w-md">
                <div
                  class="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                  style={{ "background-color": "rgba(212,164,74,0.08)" }}
                >
                  <span style={{ "font-size": "28px", color: "var(--ui-primary)" }}>&#9881;</span>
                </div>
                <h1 class="text-xl font-semibold mb-2" style={{ color: "var(--ui-text)" }}>
                  Container Manager
                </h1>
                <p class="text-sm leading-relaxed mb-8" style={{ color: "var(--ui-text-muted)" }}>
                  Define industry-specific applications through AI-guided conversation.
                  Each container becomes a complete workflow with forms, navigation, and business rules.
                </p>
                <button
                  onClick={() => setCreating(true)}
                  class="px-6 py-3 rounded-lg text-sm font-semibold cursor-pointer transition-all hover:opacity-90"
                  style={{ "background-color": "var(--ui-primary)", color: "#0B0F1A" }}
                >
                  Create Container
                </button>
              </div>
            </div>
          }
        >
          {/* ---- Header bar ---- */}
          <div
            class="flex items-center justify-between px-6 py-3 border-b shrink-0"
            style={{ "border-color": "var(--ui-border)", "background-color": "rgba(11,15,26,0.4)" }}
          >
            <div class="flex items-center gap-4">
              <div>
                <h1 class="text-base font-semibold" style={{ color: "var(--ui-text)" }}>
                  {container()?.name ?? ''}
                </h1>
                <div class="flex items-center gap-3 mt-0.5">
                  <span
                    class="text-[10px] uppercase font-semibold px-2 py-0.5 rounded"
                    style={statusBadge(container()?.status ?? 'draft')}
                  >
                    {container()?.status}
                  </span>
                  <Show when={totalCount() > 0}>
                    <span class="text-[10px]" style={{ color: "var(--ui-text-muted)" }}>
                      {reviewedCount()}/{totalCount()} reviewed
                    </span>
                  </Show>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              {/* Tab switcher */}
              <div
                class="flex rounded-lg p-0.5"
                style={{ "background-color": "rgba(240,237,232,0.04)" }}
              >
                <button
                  onClick={() => setActiveTab('chat')}
                  class="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all"
                  style={{
                    "background-color": activeTab() === 'chat' ? 'rgba(212,164,74,0.12)' : 'transparent',
                    color: activeTab() === 'chat' ? 'var(--ui-primary)' : 'var(--ui-text-muted)',
                  }}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab('manifest')}
                  class="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all"
                  style={{
                    "background-color": activeTab() === 'manifest' ? 'rgba(212,164,74,0.12)' : 'transparent',
                    color: activeTab() === 'manifest' ? 'var(--ui-primary)' : 'var(--ui-text-muted)',
                  }}
                >
                  Manifest
                  <Show when={totalCount() > 0}>
                    <span class="ml-1.5 text-[10px] tabular-nums">({totalCount()})</span>
                  </Show>
                </button>
              </div>

              {/* Provider select */}
              <select
                value={provider()}
                onChange={(e) => setProvider(e.currentTarget.value)}
                class="text-xs px-2.5 py-1.5 rounded-lg border outline-none cursor-pointer"
                style={{
                  "background-color": "rgba(240,237,232,0.04)",
                  "border-color": "var(--ui-border)",
                  color: "var(--ui-text-muted)",
                }}
              >
                <option value="ollama">Ollama</option>
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="xai">xAI</option>
              </select>

            </div>
          </div>

          {/* ---- Chat tab ---- */}
          <Show when={activeTab() === 'chat'}>
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
                            "background-color": msg.role === 'user'
                              ? 'rgba(212,164,74,0.15)'
                              : 'rgba(59,143,232,0.15)',
                            color: msg.role === 'user'
                              ? 'var(--ui-primary)'
                              : 'var(--ui-accent, #3B8FE8)',
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
                            {(seg, idx) => (
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

                      {/* Action bar for assistant messages */}
                      <Show when={msg.role === 'assistant' && container()?.status !== 'locked'}>
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
                      <span class="text-xs font-medium" style={{ color: "var(--ui-text-muted)" }}>
                        Assistant
                      </span>
                    </div>
                    <div
                      class="rounded-xl px-5 py-4"
                      style={{
                        "background-color": "rgba(240,237,232,0.02)",
                        border: "1px solid rgba(240,237,232,0.04)",
                      }}
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
            <div
              class="shrink-0 border-t"
              style={{ "border-color": "var(--ui-border)", "background-color": "rgba(11,15,26,0.4)" }}
            >
              <Show when={container()?.status !== 'locked'}>
                <div class="max-w-4xl mx-auto px-6 py-4">
                  <div
                    class="flex items-end gap-3 rounded-xl border px-4 py-3"
                    style={{
                      "background-color": "rgba(240,237,232,0.02)",
                      "border-color": "var(--ui-border)",
                    }}
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
              <Show when={container()?.status === 'locked'}>
                <div class="text-center py-4">
                  <span class="text-xs" style={{ color: "var(--ui-text-muted)" }}>
                    Container is locked — no further modifications allowed.
                  </span>
                </div>
              </Show>
            </div>
          </Show>

          {/* ---- Manifest tab ---- */}
          <Show when={activeTab() === 'manifest'}>
            <div class="flex-1 overflow-y-auto">
              <div class="max-w-4xl mx-auto px-6 py-6">
                {/* Manifest header */}
                <div class="flex items-center justify-between mb-6">
                  <div>
                    <h2 class="text-base font-semibold" style={{ color: "var(--ui-text)" }}>
                      Entity Types
                    </h2>
                    <p class="text-xs mt-0.5" style={{ color: "var(--ui-text-muted)" }}>
                      {totalCount()} defined, {reviewedCount()} reviewed
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <Show when={container()?.status !== 'locked' && entityTypes().some(e => !e.schema)}>
                      <button
                        onClick={generateAllSchemas}
                        disabled={sending()}
                        class="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40"
                        style={{
                          "background-color": "rgba(59,143,232,0.12)",
                          color: "var(--ui-accent, #3B8FE8)",
                          border: "1px solid rgba(59,143,232,0.2)",
                        }}
                      >
                        Generate Schemas ({entityTypes().filter(e => !e.schema).length} remaining)
                      </button>
                    </Show>
                    <Show when={allReviewed() && container()?.status !== 'locked'}>
                      <button
                        onClick={lockContainer}
                        class="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity"
                        style={{
                          "background-color": "rgba(34,197,94,0.12)",
                          color: "#22C55E",
                          border: "1px solid rgba(34,197,94,0.2)",
                        }}
                      >
                        Lock Container
                      </button>
                    </Show>
                  </div>
                </div>

                {/* Progress bar */}
                <Show when={totalCount() > 0}>
                  <div class="mb-6">
                    <div
                      class="h-1.5 rounded-full w-full"
                      style={{ "background-color": "rgba(240,237,232,0.06)" }}
                    >
                      <div
                        class="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${(reviewedCount() / totalCount()) * 100}%`,
                          "background-color": allReviewed()
                            ? '#22C55E'
                            : 'var(--ui-primary)',
                        }}
                      />
                    </div>
                  </div>
                </Show>

                {/* Entity type list */}
                <Show
                  when={totalCount() > 0}
                  fallback={
                    <div class="text-center py-12">
                      <p class="text-sm mb-2" style={{ color: "var(--ui-text-muted)" }}>
                        No entity types saved yet.
                      </p>
                      <p class="text-xs" style={{ color: "var(--ui-text-muted)" }}>
                        Chat with the AI to define entity types, then click "Save All to Manifest".
                      </p>
                    </div>
                  }
                >
                  <div class="space-y-2">
                    <For each={entityTypes()}>
                      {(et) => (
                        <div
                          class="rounded-xl border px-5 py-4 transition-all"
                          style={{
                            "border-color": et.reviewed
                              ? 'rgba(34,197,94,0.15)'
                              : 'var(--ui-border)',
                            "background-color": et.reviewed
                              ? 'rgba(34,197,94,0.03)'
                              : 'rgba(240,237,232,0.02)',
                          }}
                        >
                          <div class="flex items-start justify-between">
                            <div class="flex-1 min-w-0">
                              <div class="flex items-center gap-2.5">
                                <span class="text-sm font-semibold" style={{ color: "var(--ui-text)" }}>
                                  {et.name}
                                </span>
                                <Show when={et.schema}>
                                  <span
                                    class="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                    style={{ "background-color": "rgba(212,164,74,0.1)", color: "var(--ui-primary)" }}
                                  >
                                    has schema
                                  </span>
                                </Show>
                                <Show when={et.reviewed}>
                                  <span
                                    class="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                    style={{ "background-color": "rgba(34,197,94,0.1)", color: "#22C55E" }}
                                  >
                                    reviewed
                                  </span>
                                </Show>
                              </div>
                              <p class="text-xs mt-1 leading-relaxed" style={{ color: "var(--ui-text-muted)" }}>
                                {et.description}
                              </p>
                            </div>

                            {/* Actions */}
                            <div class="flex items-center gap-1.5 ml-4 shrink-0">
                              <Show when={container()?.status !== 'locked'}>
                                <Show when={!et.reviewed}>
                                  <button
                                    onClick={() => enhanceEntityType(et.name)}
                                    class="px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
                                    style={{
                                      "background-color": "rgba(59,143,232,0.08)",
                                      color: "var(--ui-accent, #3B8FE8)",
                                    }}
                                    title="Refine this entity type in chat"
                                  >
                                    Enhance
                                  </button>
                                  <button
                                    onClick={() => reviewEntityType(et.name)}
                                    class="px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
                                    style={{
                                      "background-color": "rgba(34,197,94,0.08)",
                                      color: "#22C55E",
                                    }}
                                    title={et.schema ? 'Mark as reviewed' : 'Needs a schema before reviewing'}
                                  >
                                    Review
                                  </button>
                                  <button
                                    onClick={() => removeEntityType(et.name)}
                                    class="px-2.5 py-1.5 rounded-md text-[11px] cursor-pointer hover:opacity-80 transition-opacity"
                                    style={{ color: "rgba(239,68,68,0.7)" }}
                                    title="Remove from manifest"
                                  >
                                    Remove
                                  </button>
                                </Show>
                                <Show when={et.reviewed}>
                                  <button
                                    onClick={() => unlockEntityType(et.name)}
                                    class="px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
                                    style={{ color: "var(--ui-text-muted)", "background-color": "rgba(240,237,232,0.04)" }}
                                    title="Unlock for editing"
                                  >
                                    Unlock
                                  </button>
                                </Show>
                              </Show>
                            </div>
                          </div>

                          {/* Schema view panel — reusable component */}
                          <Show when={et.schema}>
                            <div class="mt-3">
                              <SchemaPreviewPanel
                                name={et.name}
                                schema={et.schema!}
                                showHeader={false}
                              />
                            </div>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        </Show>
      </main>

      {/* Dialog overlay — renders confirm/alert modals */}
      <DialogOverlay />
    </div>
  )
}
