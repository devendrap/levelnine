import { createSignal, createEffect, onCleanup, Show, For } from 'solid-js'
import DeletePopoverIsland, { showDeletePopover } from './DeletePopoverIsland'

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    approved: 'ui-badge ui-badge-success',
    active: 'ui-badge ui-badge-success',
    complete: 'ui-badge ui-badge-success',
    review: 'ui-badge ui-badge-warning',
    pending: 'ui-badge ui-badge-warning',
    archived: 'ui-badge ui-badge-error',
    draft: 'ui-badge ui-badge-muted',
  }
  return map[status] ?? 'ui-badge ui-badge-muted'
}

function formatFieldLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '\u2014'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (typeof val === 'object') return JSON.stringify(val, null, 2)
  return String(val)
}

/** Group content fields into sections of up to `size` fields each */
function chunkFields(entries: Array<[string, unknown]>, size: number): Array<Array<[string, unknown]>> {
  const chunks: Array<Array<[string, unknown]>> = []
  for (let i = 0; i < entries.length; i += size) {
    chunks.push(entries.slice(i, i + size))
  }
  return chunks
}

export default function EntityDetailPanelIsland(props: {
  slug: string
  typeName: string
}) {
  const [entityId, setEntityId] = createSignal<string | null>(null)
  const [entity, setEntity] = createSignal<Record<string, any> | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal('')

  const label = props.typeName.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())

  // Listen for entity-selected custom events from the server-rendered list
  const handleSelection = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail?.entityId) {
      setEntityId(detail.entityId)
    }
  }

  // Attach listener on mount, clean up on unmount
  if (typeof window !== 'undefined') {
    window.addEventListener('entity-selected', handleSelection)
    onCleanup(() => window.removeEventListener('entity-selected', handleSelection))
  }

  // Fetch entity data when selection changes
  createEffect(() => {
    const id = entityId()
    if (!id) return

    let cancelled = false
    onCleanup(() => { cancelled = true })

    setLoading(true)
    setError('')

    fetch(`/api/v1/entities/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load entity')
        return r.json()
      })
      .then(data => {
        if (cancelled) return
        setEntity(data)
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message ?? 'Failed to load entity')
        setLoading(false)
      })
  })

  const contentEntries = () => {
    const e = entity()
    if (!e?.content || typeof e.content !== 'object') return []
    return Object.entries(e.content).filter(([k]) => !k.startsWith('_'))
  }

  const sections = () => chunkFields(contentEntries(), 6)

  return (
    <div class="h-full flex flex-col overflow-hidden">
      {/* Empty state */}
      <Show when={!entityId()}>
        <div class="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: 'var(--ui-text-muted)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style={{ opacity: '0.4' }}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
          <span class="text-xs">Select an item to view details</span>
        </div>
      </Show>

      {/* Loading */}
      <Show when={entityId() && loading()}>
        <div class="flex-1 flex flex-col gap-4 p-5">
          <div class="ui-skeleton" style={{ height: '20px', width: '60%' }} />
          <div class="ui-skeleton" style={{ height: '14px', width: '40%' }} />
          <div class="ui-skeleton" style={{ height: '120px', width: '100%', 'margin-top': '12px' }} />
          <div class="ui-skeleton" style={{ height: '120px', width: '100%' }} />
        </div>
      </Show>

      {/* Error */}
      <Show when={entityId() && !loading() && error()}>
        <div class="flex-1 flex items-center justify-center">
          <span class="text-xs" style={{ color: 'var(--ui-error)' }}>{error()}</span>
        </div>
      </Show>

      {/* Detail content */}
      <Show when={entityId() && !loading() && !error() && entity()}>
        <div class="flex-1 overflow-auto">
          {/* Header */}
          <div
            class="px-5 py-4 shrink-0"
            style={{ 'border-bottom': '1px solid var(--ui-border)' }}
          >
            <div class="flex items-center justify-between mb-2">
              <h2 class="text-sm font-bold truncate" style={{ color: 'var(--ui-text)' }}>
                {entity()!.name}
              </h2>
              <span class={statusBadgeClass(entity()!.status)}>
                {entity()!.status}
              </span>
            </div>
            <div class="flex items-center gap-3">
              <a
                href={`/apps/${props.slug}/${props.typeName}/${entity()!.id}`}
                class="ui-btn ui-btn-secondary ui-btn-sm"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </a>
              <a
                href={`/apps/${props.slug}/${props.typeName}/${entity()!.id}?mode=view`}
                class="ui-btn ui-btn-ghost ui-btn-sm"
              >
                View Full
              </a>
              <button
                class="ui-btn ui-btn-ghost ui-btn-sm"
                style={{ color: 'var(--ui-error)' }}
                onClick={(e: MouseEvent) => showDeletePopover(entity()!.id, e.currentTarget as HTMLElement)}
                aria-label="Delete entity"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Meta info */}
          <div
            class="px-5 py-3 flex items-center gap-4 text-[11px] shrink-0"
            style={{ color: 'var(--ui-text-placeholder)', 'border-bottom': '1px solid var(--ui-border)' }}
          >
            <Show when={entity()!.created_at}>
              <span>Created {new Date(entity()!.created_at).toLocaleDateString()}</span>
            </Show>
            <Show when={entity()!.updated_at}>
              <span>Updated {new Date(entity()!.updated_at).toLocaleDateString()}</span>
            </Show>
          </div>

          {/* Content sections */}
          <div class="p-5 flex flex-col gap-4">
            <Show
              when={contentEntries().length > 0}
              fallback={
                <div class="text-xs text-center py-8" style={{ color: 'var(--ui-text-muted)' }}>
                  No content fields to display.
                </div>
              }
            >
              <For each={sections()}>
                {(sectionFields, idx) => (
                  <div class="ui-section ui-animate-in">
                    <div class="ui-section-header">
                      <span class="ui-section-number">{idx() + 1}</span>
                      <span>
                        {idx() === 0 ? 'Details' : `Details (continued)`}
                      </span>
                    </div>
                    <div class="ui-section-body">
                      <div class="flex flex-col gap-3">
                        <For each={sectionFields}>
                          {([key, val]) => (
                            <div>
                              <label class="ui-label">{formatFieldLabel(key)}</label>
                              <Show
                                when={typeof val !== 'object' || val === null}
                                fallback={
                                  <pre
                                    class="ui-input ui-input-readonly text-xs overflow-auto"
                                    style={{ 'max-height': '120px', 'white-space': 'pre-wrap', 'word-break': 'break-word' }}
                                  >
                                    {formatValue(val)}
                                  </pre>
                                }
                              >
                                <div
                                  class="ui-input ui-input-readonly text-xs"
                                  style={{ 'min-height': '34px', display: 'flex', 'align-items': 'center' }}
                                >
                                  {formatValue(val)}
                                </div>
                              </Show>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </Show>

      {/* Delete confirmation popover */}
      <DeletePopoverIsland
        entityName={label}
        onConfirm={async (id: string) => {
          const res = await fetch(`/api/v1/entities/${id}`, { method: 'DELETE' })
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Delete failed' }))
            throw new Error(err.error ?? 'Delete failed')
          }
          // Clear selection and reload the page to refresh the list
          setEntityId(null)
          setEntity(null)
          window.location.reload()
        }}
      />
    </div>
  )
}
