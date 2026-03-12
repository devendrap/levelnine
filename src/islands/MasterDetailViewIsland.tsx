import { createSignal, Show, For, createMemo, onMount, createEffect, onCleanup } from 'solid-js'
import { useStore } from '@nanostores/solid'
import { $formData, resetFormData, seedFormData } from '../stores/ui'
import { Renderer } from '../renderer/Renderer'
import { DataGrid } from '../components/DataGrid'
import { MasterDetail } from '../components/MasterDetail'

const SELECTED_KEY = '__md_selected_id'

type ColumnDef = {
  field: string
  label: string
  width?: string
  sortable?: boolean
  filterable?: boolean
}

type DetailSection = {
  label: string
  fields?: string[]
  related_entity_type?: string
}

export default function MasterDetailViewIsland(props: {
  containerId: string
  slug: string
  typeName: string
  entityTypeId: string
  schema?: Record<string, any>
  columns: ColumnDef[]
  entities: Array<Record<string, any>>
  total: number
  splitRatio?: string
  detailConfig?: {
    layout?: string
    sections?: DetailSection[]
  } | null
}) {
  const formData = useStore($formData)
  const [selectedEntity, setSelectedEntity] = createSignal<Record<string, any> | null>(null)
  const [name, setName] = createSignal('')
  const [status, setStatus] = createSignal('draft')
  const [saving, setSaving] = createSignal(false)
  const [error, setError] = createSignal('')
  const [saved, setSaved] = createSignal(false)

  const label = props.typeName.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())

  // Add name + status columns if not already in grid_config
  const gridColumns = createMemo(() => {
    const cols: ColumnDef[] = []
    const fieldSet = new Set(props.columns.map(c => c.field))
    if (!fieldSet.has('name')) {
      cols.push({ field: 'name', label: 'Name', sortable: true })
    }
    cols.push(...props.columns)
    if (!fieldSet.has('status')) {
      cols.push({ field: 'status', label: 'Status', sortable: true })
    }
    return cols
  })

  // Watch for DataGrid selection changes via $formData bind
  createEffect(() => {
    const selectedId = formData()[SELECTED_KEY]
    if (!selectedId) return
    const entity = props.entities.find(e => e.id === selectedId)
    if (entity && entity.id !== selectedEntity()?.id) {
      setSelectedEntity(entity)
      setName(entity.name ?? '')
      setStatus(entity.status ?? 'draft')

      // Fetch full entity content — use cancellation to prevent race conditions
      let cancelled = false
      onCleanup(() => { cancelled = true })

      fetch(`/api/v1/entities/${entity.id}`)
        .then(r => r.json())
        .then(full => {
          if (cancelled) return
          const selId = $formData.get()[SELECTED_KEY]
          seedFormData(full.content ?? {})
          $formData.setKey(SELECTED_KEY, selId)
        })
        .catch((err) => {
          if (!cancelled) setError(err.message ?? 'Failed to load entity')
        })
    }
  })

  const save = async () => {
    const entity = selectedEntity()
    if (!entity?.id) return
    if (!name().trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const content = { ...formData() }
      const res = await fetch(`/api/v1/entities/${entity.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name(), status: status(), content }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? 'Save failed')
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const statuses = ['draft', 'active', 'review', 'approved', 'archived']

  return (
    <div class="h-full flex flex-col">
      {/* Top bar */}
      <div
        class="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ 'border-bottom': '1px solid var(--ui-border)' }}
      >
        <div class="flex items-center gap-3">
          <h1 class="text-sm font-bold" style={{ color: 'var(--ui-text)' }}>{label}</h1>
          <span class="text-[11px]" style={{ color: 'var(--ui-text-placeholder)' }}>
            {props.total} record{props.total !== 1 ? 's' : ''}
          </span>
        </div>
        <a
          href={`/apps/${props.slug}/${props.typeName}/new`}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
          style={{ 'background-color': 'var(--ui-primary)', color: 'var(--ui-text-on-primary)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New
        </a>
      </div>

      {/* MasterDetail layout */}
      <div class="flex-1 min-h-0">
        <MasterDetail splitRatio={props.splitRatio ?? '40/60'}>
          {/* Left: DataGrid */}
          <DataGrid
            columns={gridColumns()}
            data={props.entities}
            selectedId={selectedEntity()?.id}
            searchable={true}
            pageSize={50}
            bind={SELECTED_KEY}
          />

          {/* Right: Detail panel */}
          <Show
            when={selectedEntity()}
            fallback={
              <div class="flex-1 flex items-center justify-center text-xs" style={{ color: 'var(--ui-text-muted)' }}>
                Select a {label.toLowerCase()} to view details
              </div>
            }
          >
            <div class="flex flex-col h-full overflow-auto">
              {/* Detail header */}
              <div
                class="flex items-center justify-between px-5 py-3 shrink-0"
                style={{ 'border-bottom': '1px solid var(--ui-border)' }}
              >
                <div class="flex items-center gap-2 min-w-0">
                  <span class="text-sm font-semibold truncate" style={{ color: 'var(--ui-text)' }}>
                    {name()}
                  </span>
                  <span
                    class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{
                      'background-color': status() === 'approved' ? 'var(--ui-success-bg)' :
                        status() === 'review' ? 'var(--ui-warning-bg)' : 'rgba(240,237,232,0.06)',
                      color: status() === 'approved' ? 'var(--ui-success)' :
                        status() === 'review' ? 'var(--ui-warning)' : 'var(--ui-text-muted)',
                    }}
                  >
                    {status()}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <Show when={error()}>
                    <span class="text-[10px]" style={{ color: 'var(--ui-error)' }}>{error()}</span>
                  </Show>
                  <Show when={saved()}>
                    <span class="text-[10px]" style={{ color: 'var(--ui-success)' }}>Saved</span>
                  </Show>
                  <button
                    onClick={save}
                    disabled={saving()}
                    class="px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all hover:opacity-90 disabled:opacity-40"
                    style={{ 'background-color': 'var(--ui-primary)', color: 'var(--ui-text-on-primary)' }}
                  >
                    {saving() ? 'Saving...' : 'Save'}
                  </button>
                  <a
                    href={`/apps/${props.slug}/${props.typeName}/${selectedEntity()!.id}`}
                    class="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
                    style={{ color: 'var(--ui-text-muted)', border: '1px solid var(--ui-border)' }}
                  >
                    Full Page
                  </a>
                </div>
              </div>

              {/* Name + Status compact row */}
              <div class="px-5 py-3 shrink-0" style={{ 'border-bottom': '1px solid var(--ui-border)' }}>
                <div class="flex gap-3">
                  <div class="flex-1">
                    <label class="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--ui-text-muted)' }}>Name</label>
                    <input
                      type="text"
                      value={name()}
                      onInput={(e) => setName(e.currentTarget.value)}
                      class="w-full bg-transparent outline-none text-xs px-2 py-1.5 rounded-lg"
                      style={{ color: 'var(--ui-text)', border: '1px solid var(--ui-border)', 'background-color': 'rgba(240,237,232,0.02)' }}
                    />
                  </div>
                  <div style={{ width: '120px' }}>
                    <label class="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--ui-text-muted)' }}>Status</label>
                    <select
                      value={status()}
                      onChange={(e) => setStatus(e.currentTarget.value)}
                      class="w-full bg-transparent outline-none text-xs px-2 py-1.5 rounded-lg cursor-pointer"
                      style={{ color: 'var(--ui-text)', border: '1px solid var(--ui-border)', 'background-color': 'var(--ui-bg-subtle)' }}
                    >
                      <For each={statuses}>
                        {(s) => (
                          <option value={s} style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)' }}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </option>
                        )}
                      </For>
                    </select>
                  </div>
                </div>
              </div>

              {/* Schema-rendered form OR detail_config sections */}
              <div class="flex-1 overflow-auto p-5">
                <Show when={props.schema}>
                  <Renderer node={props.schema as any} />
                </Show>
              </div>
            </div>
          </Show>
        </MasterDetail>
      </div>
    </div>
  )
}
