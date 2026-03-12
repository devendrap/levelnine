import { createSignal, createEffect, Show, For, createMemo, ErrorBoundary } from 'solid-js'
import { Renderer } from '../renderer/Renderer'
import Toast, { showToast } from '../components/containers/Toast'
import { $provider, $manifestTotal, $manifestSchemaReady, $manifestReviewed, $manifestGenerating } from '../stores/manifest'

interface EntityTypeDef {
  name: string
  description?: string
  key_fields?: string[]
  schema?: Record<string, any>
  reviewed?: boolean
}

export default function ManifestTableIsland(props: {
  containerId: string
  containerStatus: string
  containerSlug?: string
  entityTypes: EntityTypeDef[]
}) {
  const [selected, setSelected] = createSignal<Set<string>>(new Set())
  const [activePreview, setActivePreview] = createSignal<string | null>(null)
  const [previewMode, setPreviewMode] = createSignal<'preview' | 'code'>('preview')
  const [generating, setGenerating] = createSignal(false)
  const [completed, setCompleted] = createSignal(0)
  const [results, setResults] = createSignal<Array<{ name: string; success: boolean; error?: string }>>([])
  const [confirmAction, setConfirmAction] = createSignal<{ title: string; message: string; onConfirm: () => void } | null>(null)

  // Reactive entity types — starts from props, updates live during SSE generation
  const [entityTypes, setEntityTypes] = createSignal<EntityTypeDef[]>(props.entityTypes)

  const isLocked = () => props.containerStatus === 'locked' || props.containerStatus === 'launched'

  const totalCount = () => entityTypes().length
  const reviewedCount = () => entityTypes().filter(e => e.reviewed).length
  const schemaReadyCount = () => entityTypes().filter(e => e.schema).length
  const allReviewed = () => totalCount() > 0 && reviewedCount() === totalCount()
  const missingSchemas = () => entityTypes().filter(e => !e.schema).length

  // Sync counts to shared nanostore for header + sidebar islands
  createEffect(() => {
    $manifestTotal.set(totalCount())
    $manifestSchemaReady.set(schemaReadyCount())
    $manifestReviewed.set(reviewedCount())
    $manifestGenerating.set(generating())
  })

  const allChecked = () => selected().size === totalCount() && totalCount() > 0
  const someChecked = () => selected().size > 0 && selected().size < totalCount()

  const toggleAll = () => {
    if (allChecked()) setSelected(new Set())
    else setSelected(new Set(entityTypes().map(e => e.name)))
  }

  const toggleOne = (name: string) => {
    const s = new Set(selected())
    if (s.has(name)) s.delete(name)
    else s.add(name)
    setSelected(s)
  }

  const activeSchema = createMemo(() => {
    if (!activePreview()) return null
    return entityTypes().find(e => e.name === activePreview())
  })

  const apiCall = async (url: string, method: string, body?: any) => {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.ok) window.location.reload()
    else {
      const err = await res.json()
      showToast(err.error)
    }
  }

  const reviewSelected = () => {
    const names = [...selected()]
    if (names.length === 0) return
    apiCall(`/api/v1/containers/${props.containerId}/review`, 'POST', { names })
  }

  const removeSelected = () => {
    const names = [...selected()]
    if (names.length === 0) return
    setConfirmAction({
      title: 'Remove Entity Types',
      message: `Remove ${names.length} entity type${names.length > 1 ? 's' : ''} from the manifest? This will delete their schemas.`,
      onConfirm: () => {
        setConfirmAction(null)
        apiCall(`/api/v1/containers/${props.containerId}/entity-types`, 'DELETE', { names })
      },
    })
  }

  const enhance = (name: string) => {
    window.location.href = `/containers/${props.containerId}?enhance=${encodeURIComponent(name)}`
  }

  const generateSchemas = async () => {
    setGenerating(true)
    setCompleted(0)
    setResults([])
    try {
      const res = await fetch(`/api/v1/containers/${props.containerId}/generate-schemas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: $provider.get() }),
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        setResults([{ name: 'error', success: false, error: err.error }])
        setGenerating(false)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) eventType = line.slice(7)
          else if (line.startsWith('data: ')) {
            let data: any
            try { data = JSON.parse(line.slice(6)) } catch { continue }
            if (eventType === 'progress') {
              setCompleted(data.index)
              setResults(prev => [...prev, { name: data.name, success: data.success, error: data.error }])
              // Update entity type with schema in real-time
              if (data.success && data.schema) {
                setEntityTypes(prev => prev.map(et =>
                  et.name === data.name ? { ...et, schema: data.schema } : et
                ))
              }
            } else if (eventType === 'done') {
              setGenerating(false)
            } else if (eventType === 'error') {
              setResults(prev => [...prev, { name: 'error', success: false, error: data.error }])
              setGenerating(false)
            }
          }
        }
      }
    } catch (e: any) {
      setResults(prev => [...prev, { name: 'error', success: false, error: e.message }])
      setGenerating(false)
    }
  }

  const lockContainer = () => {
    setConfirmAction({
      title: 'Lock Container',
      message: `Lock this container with ${totalCount()} entity types? Once locked, entity types cannot be added or removed.`,
      onConfirm: () => {
        setConfirmAction(null)
        apiCall(`/api/v1/containers/${props.containerId}/lock`, 'POST')
      },
    })
  }

  const launchApp = async () => {
    const res = await fetch(`/api/v1/containers/${props.containerId}/launch`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      window.location.href = data.appUrl
    } else {
      const err = await res.json()
      showToast(err.error)
    }
  }

  return (
    <>
    <Toast />
    <div class="flex-1 flex flex-col overflow-hidden">
      {/* Top bar: title + actions */}
      <div class="flex items-center justify-between px-6 py-4 shrink-0" style={{ 'border-bottom': '1px solid var(--ui-border)' }}>
        <div>
          <h2 class="text-base font-semibold" style={{ color: 'var(--ui-text)' }}>Entity Types</h2>
          <p class="text-xs mt-0.5" style={{ color: 'var(--ui-text-muted)' }}>
            {totalCount()} defined, {schemaReadyCount()} with schema, {reviewedCount()} reviewed
          </p>
        </div>
        <div class="flex items-center gap-2">
          <Show when={!isLocked() && missingSchemas() > 0}>
            <button
              onClick={generateSchemas}
              disabled={generating()}
              class="px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-90 transition-all"
              style={{
                'background-color': generating() ? 'rgba(212,164,74,0.18)' : 'rgba(59,143,232,0.12)',
                color: generating() ? 'var(--ui-primary)' : 'var(--ui-accent, #3B8FE8)',
                border: generating() ? '1px solid rgba(212,164,74,0.35)' : '1px solid rgba(59,143,232,0.2)',
                'box-shadow': generating() ? '0 0 12px rgba(212,164,74,0.15)' : 'none',
              }}
            >
              {generating()
                ? `Generating... ${completed()}/${missingSchemas()}`
                : `Generate Schemas (${missingSchemas()})`}
            </button>
          </Show>
          <Show when={allReviewed() && props.containerStatus !== 'locked' && props.containerStatus !== 'launched'}>
            <button
              onClick={lockContainer}
              class="px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity"
              style={{ 'background-color': 'rgba(34,197,94,0.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              Lock Container
            </button>
          </Show>
          <Show when={props.containerStatus === 'locked'}>
            <button
              onClick={launchApp}
              class="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, var(--ui-primary) 0%, var(--ui-primary-hover) 100%)', color: 'var(--ui-text-on-primary)', 'box-shadow': '0 2px 12px rgba(212,164,74,0.3)' }}
            >
              Launch App
            </button>
          </Show>
          <Show when={props.containerStatus === 'launched'}>
            <a
              href={`/apps/${props.containerSlug}`}
              class="px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-2 hover:opacity-90 transition-all"
              style={{ 'background-color': 'rgba(212,164,74,0.12)', color: 'var(--ui-primary)', border: '1px solid rgba(212,164,74,0.2)' }}
            >
              Open App
            </a>
          </Show>
        </div>
      </div>

      {/* SSE progress feed */}
      <Show when={results().length > 0}>
        <div
          class="mx-6 mt-3 rounded-lg p-3 text-xs max-h-32 overflow-y-auto shrink-0"
          style={{ 'background-color': 'rgba(240,237,232,0.03)', border: '1px solid var(--ui-border)' }}
        >
          <For each={results()}>
            {(r) => (
              <div class="flex items-center gap-2 py-0.5">
                <span style={{ color: r.success ? '#22C55E' : 'rgba(239,68,68,0.8)' }}>
                  {r.success ? '\u2713' : '\u2717'}
                </span>
                <span style={{ color: 'var(--ui-text)' }}>{r.name}</span>
                <Show when={r.error}>
                  <span style={{ color: 'var(--ui-text-muted)' }}>{'\u2014'} {r.error}</span>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Bulk actions bar */}
      <Show when={selected().size > 0 && !isLocked()}>
        <div
          class="flex items-center gap-2 mx-6 mt-3 px-4 py-2.5 rounded-lg shrink-0"
          style={{ 'background-color': 'rgba(212,164,74,0.06)', border: '1px solid rgba(212,164,74,0.12)' }}
        >
          <span class="text-xs font-medium" style={{ color: 'var(--ui-text)' }}>
            {selected().size} selected
          </span>
          <div class="flex-1" />
          <button
            onClick={reviewSelected}
            class="px-3 py-1.5 rounded-md text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
            style={{ 'background-color': 'rgba(34,197,94,0.1)', color: '#22C55E' }}
          >
            Review Selected
          </button>
          <button
            onClick={removeSelected}
            class="px-3 py-1.5 rounded-md text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
            style={{ color: 'rgba(239,68,68,0.7)' }}
          >
            Remove
          </button>
        </div>
      </Show>

      <Show when={totalCount() === 0}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <p class="text-sm mb-2" style={{ color: 'var(--ui-text-muted)' }}>No entity types saved yet.</p>
            <p class="text-xs" style={{ color: 'var(--ui-text-muted)' }}>
              Chat with the AI to define entity types, then click "Save All to Manifest".
            </p>
          </div>
        </div>
      </Show>

      {/* Master-detail split */}
      <Show when={totalCount() > 0}>
        <div class="flex-1 flex min-h-0 mt-3">
          {/* Left: table */}
          <div
            class="overflow-y-auto"
            style={{
              width: activeSchema() ? '45%' : '100%',
              transition: 'width 0.2s ease',
              'border-right': activeSchema() ? '1px solid var(--ui-border)' : 'none',
            }}
          >
            <table class="w-full">
              <thead class="sticky top-0 z-10">
                <tr style={{ 'background-color': 'var(--ui-bg-subtle)' }}>
                  <Show when={!isLocked()}>
                    <th class="w-10 px-3 py-2.5">
                      <div
                        onClick={toggleAll}
                        class="w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-all"
                        style={{
                          'border-color': allChecked() || someChecked() ? 'var(--ui-primary)' : 'var(--ui-border)',
                          'background-color': allChecked() ? 'var(--ui-primary)' : someChecked() ? 'rgba(212,164,74,0.3)' : 'transparent',
                        }}
                      >
                        <Show when={allChecked() || someChecked()}>
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                            <Show when={allChecked()}>
                              <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="var(--ui-text-on-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            </Show>
                            <Show when={someChecked()}>
                              <path d="M4 8H12" stroke="var(--ui-text-on-primary)" stroke-width="2" stroke-linecap="round" />
                            </Show>
                          </svg>
                        </Show>
                      </div>
                    </th>
                  </Show>
                  <th class="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ui-text-muted)' }}>Name</th>
                  <Show when={!activeSchema()}>
                    <th class="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ui-text-muted)' }}>Description</th>
                  </Show>
                  <th class="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ui-text-muted)' }}>Schema</th>
                  <th class="text-center px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ui-text-muted)' }}>Status</th>
                  <Show when={!isLocked() && !activeSchema()}>
                    <th class="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ui-text-muted)' }}>Actions</th>
                  </Show>
                </tr>
              </thead>
              <tbody>
                <For each={entityTypes()}>
                  {(et) => {
                    const isActive = () => activePreview() === et.name
                    const isChecked = () => selected().has(et.name)
                    return (
                      <tr
                        onClick={() => setActivePreview(isActive() ? null : et.name)}
                        class="border-t cursor-pointer transition-colors"
                        style={{
                          'border-color': 'var(--ui-border)',
                          'background-color': isActive() ? 'rgba(212,164,74,0.08)' : 'transparent',
                        }}
                      >
                        <Show when={!isLocked()}>
                          <td class="w-10 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <div
                              onClick={() => toggleOne(et.name)}
                              class="w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-all"
                              style={{
                                'border-color': isChecked() ? 'var(--ui-primary)' : 'var(--ui-border)',
                                'background-color': isChecked() ? 'var(--ui-primary)' : 'transparent',
                              }}
                            >
                              <Show when={isChecked()}>
                                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                                  <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="var(--ui-text-on-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                              </Show>
                            </div>
                          </td>
                        </Show>
                        <td class="px-4 py-2.5">
                          <span
                            class="text-sm font-semibold"
                            style={{ color: isActive() ? 'var(--ui-primary)' : 'var(--ui-text)' }}
                          >
                            {et.name}
                          </span>
                        </td>
                        <Show when={!activeSchema()}>
                          <td class="px-4 py-2.5">
                            <span class="text-xs leading-relaxed line-clamp-1" style={{ color: 'var(--ui-text-muted)' }}>
                              {et.description ?? '\u2014'}
                            </span>
                          </td>
                        </Show>
                        <td class="px-3 py-2.5 text-center">
                          <Show when={et.schema} fallback={
                            <span class="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ 'background-color': 'rgba(240,237,232,0.06)', color: 'var(--ui-text-muted)' }}>missing</span>
                          }>
                            <span class="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ 'background-color': 'rgba(212,164,74,0.1)', color: 'var(--ui-primary)' }}>ready</span>
                          </Show>
                        </td>
                        <td class="px-3 py-2.5 text-center">
                          <Show when={et.reviewed} fallback={
                            <span class="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ 'background-color': 'rgba(240,237,232,0.06)', color: 'var(--ui-text-muted)' }}>pending</span>
                          }>
                            <span class="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ 'background-color': 'rgba(34,197,94,0.1)', color: '#22C55E' }}>reviewed</span>
                          </Show>
                        </td>
                        <Show when={!isLocked() && !activeSchema()}>
                          <td class="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div class="flex items-center justify-end gap-1.5">
                              <Show when={!et.reviewed}>
                                <button
                                  onClick={() => enhance(et.name)}
                                  class="px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
                                  style={{ 'background-color': 'rgba(59,143,232,0.08)', color: 'var(--ui-accent, #3B8FE8)' }}
                                >
                                  Enhance
                                </button>
                              </Show>
                              <Show when={et.reviewed}>
                                <button
                                  onClick={() => apiCall(`/api/v1/containers/${props.containerId}/unlock`, 'POST', { name: et.name })}
                                  class="px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
                                  style={{ color: 'var(--ui-text-muted)', 'background-color': 'rgba(240,237,232,0.04)' }}
                                >
                                  Unlock
                                </button>
                              </Show>
                            </div>
                          </td>
                        </Show>
                      </tr>
                    )
                  }}
                </For>
              </tbody>
            </table>
          </div>

          {/* Right: preview panel */}
          <Show when={activeSchema()}>
            <div class="flex flex-col min-h-0 overflow-hidden" style={{ width: '55%' }}>
              {/* Preview header */}
              <div
                class="flex items-center justify-between px-5 py-3 shrink-0"
                style={{ 'background-color': 'rgba(212,164,74,0.03)', 'border-bottom': '1px solid rgba(212,164,74,0.12)' }}
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ui-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M9 3v18" />
                  </svg>
                  <span class="text-sm font-semibold truncate" style={{ color: 'var(--ui-text)' }}>
                    {activeSchema()!.name}
                  </span>
                  <Show when={activeSchema()!.description}>
                    <span class="text-xs truncate" style={{ color: 'var(--ui-text-muted)' }}>
                      {'\u2014'} {activeSchema()!.description}
                    </span>
                  </Show>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  {/* Preview / Code pill toggle */}
                  <div class="flex items-center gap-0.5 rounded-lg p-0.5" style={{ 'background-color': 'rgba(240,237,232,0.06)' }}>
                    <button
                      onClick={() => setPreviewMode('preview')}
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium cursor-pointer transition-all"
                      style={{
                        'background-color': previewMode() === 'preview' ? 'rgba(212,164,74,0.18)' : 'transparent',
                        color: previewMode() === 'preview' ? 'var(--ui-primary)' : 'var(--ui-text-muted)',
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      Preview
                    </button>
                    <button
                      onClick={() => setPreviewMode('code')}
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium cursor-pointer transition-all"
                      style={{
                        'background-color': previewMode() === 'code' ? 'rgba(59,143,232,0.18)' : 'transparent',
                        color: previewMode() === 'code' ? 'var(--ui-accent, #3B8FE8)' : 'var(--ui-text-muted)',
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                      </svg>
                      Code
                    </button>
                  </div>
                  {/* Close button */}
                  <button
                    onClick={() => setActivePreview(null)}
                    class="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity ml-1"
                    style={{ color: 'var(--ui-text-muted)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Preview content — scrollable */}
              <div class="flex-1 overflow-y-auto p-5">
                <Show when={previewMode() === 'preview' && activeSchema()!.schema}>
                  <div
                    class="rounded-lg p-4"
                    style={{
                      border: '1.5px solid rgba(212,164,74,0.25)',
                      'box-shadow': '0 0 12px rgba(212,164,74,0.06)',
                      'background-color': 'rgba(240,237,232,0.02)',
                    }}
                  >
                    <ErrorBoundary fallback={(err: Error) => (
                      <div class="text-xs p-3" style={{ color: 'rgba(239,68,68,0.8)' }}>
                        Render error: {err.message}
                      </div>
                    )}>
                      <Renderer node={activeSchema()!.schema as any} />
                    </ErrorBoundary>
                  </div>
                </Show>
                <Show when={previewMode() === 'preview' && !activeSchema()!.schema}>
                  <div class="flex items-center justify-center h-full">
                    <p class="text-sm" style={{ color: 'var(--ui-text-muted)' }}>No schema generated yet.</p>
                  </div>
                </Show>
                <Show when={previewMode() === 'code' && activeSchema()!.schema}>
                  <pre
                    class="rounded-lg border overflow-y-auto text-xs leading-relaxed"
                    style={{
                      'border-color': 'rgba(59,143,232,0.15)',
                      'background-color': 'rgba(59,143,232,0.03)',
                      padding: '16px',
                      color: 'var(--ui-text)',
                      'white-space': 'pre-wrap',
                      'word-break': 'break-word',
                      'font-family': "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
                      'font-size': '11px',
                    }}
                  >
                    {JSON.stringify(activeSchema()!.schema, null, 2)}
                  </pre>
                </Show>
                <Show when={previewMode() === 'code' && !activeSchema()!.schema}>
                  <div class="flex items-center justify-center h-full">
                    <p class="text-sm" style={{ color: 'var(--ui-text-muted)' }}>No schema generated yet.</p>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Confirmation dialog overlay */}
      <Show when={confirmAction()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center"
          style={{ 'background-color': 'rgba(0,0,0,0.6)', 'backdrop-filter': 'blur(4px)' }}
          onClick={() => setConfirmAction(null)}
        >
          <div
            class="rounded-xl p-6 w-full max-w-sm shadow-2xl"
            style={{
              'background-color': 'var(--ui-card-bg)',
              border: '1px solid var(--ui-border)',
              'box-shadow': '0 24px 48px rgba(0,0,0,0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Warning icon */}
            <div
              class="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
              style={{ 'background-color': 'rgba(234,179,8,0.1)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EAB308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <h3 class="text-sm font-semibold mb-1.5" style={{ color: 'var(--ui-text)' }}>
              {confirmAction()!.title}
            </h3>
            <p class="text-xs leading-relaxed mb-5" style={{ color: 'var(--ui-text-muted)' }}>
              {confirmAction()!.message}
            </p>

            <div class="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                class="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
                style={{ color: 'var(--ui-text-muted)', 'background-color': 'rgba(240,237,232,0.06)', border: '1px solid var(--ui-border)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => confirmAction()!.onConfirm()}
                class="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  'background-color': 'rgba(234,179,8,0.15)',
                  color: '#EAB308',
                  border: '1px solid rgba(234,179,8,0.25)',
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
    </>
  )
}
