import { createSignal, createMemo, For } from 'solid-js'
import { useStore } from '@nanostores/solid'
import { $formData } from '../stores/ui'

export function Pagination(props: { totalPages: number; bind?: string }) {
  const formData = useStore($formData)
  const [localPage, setLocalPage] = createSignal(1)

  const page = () => {
    if (props.bind) {
      const v = parseInt(formData()[props.bind] ?? '1', 10)
      return isNaN(v) ? 1 : Math.max(1, Math.min(v, props.totalPages))
    }
    return localPage()
  }

  const setPage = (p: number) => {
    const clamped = Math.max(1, Math.min(p, props.totalPages))
    if (props.bind) $formData.setKey(props.bind, String(clamped))
    else setLocalPage(clamped)
  }

  const visiblePages = createMemo(() => {
    const total = props.totalPages
    const current = page()
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    const pages: (number | null)[] = [1]
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    if (start > 2) pages.push(null) // ellipsis
    for (let i = start; i <= end; i++) pages.push(i)
    if (end < total - 1) pages.push(null) // ellipsis
    pages.push(total)
    return pages
  })

  const btnStyle = (active: boolean, disabled: boolean) => ({
    width: '36px',
    height: '36px',
    color: disabled ? 'var(--ui-text-placeholder)' : active ? '#0B0F1A' : 'var(--ui-text)',
    "background-color": active ? 'var(--ui-primary)' : 'transparent',
    "border-color": active ? 'var(--ui-primary)' : 'var(--ui-border)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? '0.5' : '1',
  })

  return (
    <nav class="flex items-center gap-1" aria-label="Pagination">
      {/* Prev */}
      <button
        type="button"
        class="flex items-center justify-center rounded-lg border text-sm transition-colors duration-100"
        style={btnStyle(false, page() === 1)}
        disabled={page() === 1}
        onClick={() => setPage(page() - 1)}
      >
        <svg viewBox="0 0 16 16" fill="none" style={{ width: '14px', height: '14px' }}>
          <path d="M10 4l-4 4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      {/* Pages */}
      <For each={visiblePages()}>
        {(p) => {
          if (p === null) {
            return (
              <span
                class="flex items-center justify-center text-sm"
                style={{ width: '36px', height: '36px', color: 'var(--ui-text-muted)' }}
              >...</span>
            )
          }
          return (
            <button
              type="button"
              class="flex items-center justify-center rounded-lg border text-sm font-medium transition-all duration-100"
              style={btnStyle(p === page(), false)}
              onClick={() => setPage(p)}
            >{p}</button>
          )
        }}
      </For>

      {/* Next */}
      <button
        type="button"
        class="flex items-center justify-center rounded-lg border text-sm transition-colors duration-100"
        style={btnStyle(false, page() === props.totalPages)}
        disabled={page() === props.totalPages}
        onClick={() => setPage(page() + 1)}
      >
        <svg viewBox="0 0 16 16" fill="none" style={{ width: '14px', height: '14px' }}>
          <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </nav>
  )
}
