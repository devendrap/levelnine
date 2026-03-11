import { createSignal, For, Show, createMemo } from 'solid-js'
import { useStore } from '@nanostores/solid'
import { $formData } from '../stores/ui'

type ColumnDef = {
  field: string
  label: string
  width?: string
  sortable?: boolean
  filterable?: boolean
}

export function DataGrid(props: {
  columns: ColumnDef[]
  data?: Record<string, any>[]
  selectedId?: string
  idField?: string
  bind?: string
  pageSize?: number
  searchable?: boolean
  onSelect?: string
}) {
  const formData = useStore($formData)
  const idKey = () => props.idField ?? 'id'
  const pageSize = () => props.pageSize ?? 20

  const [sortField, setSortField] = createSignal<string | null>(null)
  const [sortDir, setSortDir] = createSignal<'asc' | 'desc'>('asc')
  const [search, setSearch] = createSignal('')
  const [page, setPage] = createSignal(0)
  const [selectedId, setSelectedId] = createSignal(props.selectedId ?? '')

  const rows = () => props.data ?? []

  // Filter
  const filtered = createMemo(() => {
    const q = search().toLowerCase()
    if (!q) return rows()
    return rows().filter(row =>
      props.columns.some(col => String(row[col.field] ?? '').toLowerCase().includes(q)),
    )
  })

  // Sort
  const sorted = createMemo(() => {
    const f = sortField()
    if (!f) return filtered()
    const dir = sortDir() === 'asc' ? 1 : -1
    return [...filtered()].sort((a, b) => {
      const av = a[f] ?? ''
      const bv = b[f] ?? ''
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  })

  // Paginate
  const paged = createMemo(() => {
    const start = page() * pageSize()
    return sorted().slice(start, start + pageSize())
  })

  const totalPages = createMemo(() => Math.max(1, Math.ceil(sorted().length / pageSize())))

  function handleSort(field: string) {
    if (sortField() === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
    setPage(0)
  }

  function handleSelect(row: Record<string, any>) {
    const id = String(row[idKey()] ?? '')
    setSelectedId(id)
    if (props.bind) {
      $formData.setKey(props.bind, id)
    }
  }

  function sortIcon(field: string) {
    if (sortField() !== field) return ' ↕'
    return sortDir() === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div class="flex flex-col" style={{ color: 'var(--ui-text)' }}>
      {/* Search */}
      <Show when={props.searchable}>
        <div class="px-3 py-2" style={{ 'border-bottom': '1px solid var(--ui-border)' }}>
          <input
            type="text"
            placeholder="Search..."
            value={search()}
            onInput={(e) => { setSearch(e.currentTarget.value); setPage(0) }}
            class="w-full px-3 py-1.5 rounded-lg text-xs"
            style={{
              'background-color': 'var(--ui-bg-subtle)',
              color: 'var(--ui-text)',
              border: '1px solid var(--ui-border)',
              outline: 'none',
            }}
          />
        </div>
      </Show>

      {/* Table */}
      <div class="overflow-auto flex-1">
        <table class="w-full text-sm" style={{ 'border-collapse': 'collapse' }}>
          <thead>
            <tr style={{ 'background-color': 'var(--ui-bg-subtle)' }}>
              <For each={props.columns}>
                {(col) => (
                  <th
                    class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider select-none"
                    style={{
                      color: 'var(--ui-text-muted)',
                      'border-bottom': '1px solid var(--ui-border)',
                      width: col.width ?? 'auto',
                      cursor: col.sortable !== false ? 'pointer' : 'default',
                    }}
                    onClick={() => col.sortable !== false && handleSort(col.field)}
                  >
                    {col.label}
                    <Show when={col.sortable !== false}>
                      <span class="text-[9px] opacity-50">{sortIcon(col.field)}</span>
                    </Show>
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={paged()} fallback={
              <tr>
                <td
                  class="px-3 py-8 text-center text-xs"
                  style={{ color: 'var(--ui-text-muted)' }}
                  colSpan={props.columns.length}
                >
                  No data
                </td>
              </tr>
            }>
              {(row) => {
                const id = () => String(row[idKey()] ?? '')
                const isSelected = () => selectedId() === id()
                return (
                  <tr
                    class="cursor-pointer transition-colors"
                    style={{
                      'background-color': isSelected() ? 'rgba(212,164,74,0.1)' : 'transparent',
                      'border-bottom': '1px solid var(--ui-border)',
                    }}
                    onClick={() => handleSelect(row)}
                    onMouseEnter={(e) => {
                      if (!isSelected()) e.currentTarget.style.backgroundColor = 'rgba(240,237,232,0.04)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected()) e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <For each={props.columns}>
                      {(col) => (
                        <td
                          class="px-3 py-2.5 text-xs truncate"
                          style={{
                            'max-width': col.width ?? '200px',
                            'font-weight': isSelected() ? '500' : '400',
                            color: isSelected() ? 'var(--ui-text)' : 'var(--ui-text-muted)',
                          }}
                        >
                          {String(row[col.field] ?? '')}
                        </td>
                      )}
                    </For>
                  </tr>
                )
              }}
            </For>
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Show when={totalPages() > 1}>
        <div
          class="flex items-center justify-between px-3 py-2 text-[10px]"
          style={{ 'border-top': '1px solid var(--ui-border)', color: 'var(--ui-text-muted)' }}
        >
          <span>{sorted().length} rows</span>
          <div class="flex items-center gap-1">
            <button
              class="px-2 py-1 rounded cursor-pointer"
              style={{ background: 'none', border: 'none', color: 'var(--ui-text-muted)' }}
              disabled={page() === 0}
              onClick={() => setPage(p => p - 1)}
            >
              ‹
            </button>
            <span>{page() + 1} / {totalPages()}</span>
            <button
              class="px-2 py-1 rounded cursor-pointer"
              style={{ background: 'none', border: 'none', color: 'var(--ui-text-muted)' }}
              disabled={page() >= totalPages() - 1}
              onClick={() => setPage(p => p + 1)}
            >
              ›
            </button>
          </div>
        </div>
      </Show>
    </div>
  )
}
