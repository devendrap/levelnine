import { createSignal, createEffect, onCleanup, Show } from 'solid-js'
import { showToast } from '../components/containers/Toast'

interface Props {
  onConfirm: (id: string) => Promise<void>
  entityName?: string
}

interface PopoverState {
  entityId: string
  triggerEl: HTMLElement
}

const [popoverState, setPopoverState] = createSignal<PopoverState | null>(null)

export function showDeletePopover(entityId: string, triggerEl: HTMLElement) {
  setPopoverState({ entityId, triggerEl })
}

export default function DeletePopoverIsland(props: Props) {
  const [loading, setLoading] = createSignal(false)
  const [position, setPosition] = createSignal({ top: 0, left: 0 })
  let containerRef: HTMLDivElement | undefined

  function computePosition(triggerEl: HTMLElement) {
    const rect = triggerEl.getBoundingClientRect()
    const popoverWidth = 260
    const popoverHeight = 120
    const margin = 16
    const gap = 6

    // Horizontal: center on trigger, clamp to viewport
    let left = rect.left + rect.width / 2 - popoverWidth / 2
    left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin))

    // Vertical: prefer below, flip above if clipping
    let top = rect.bottom + gap
    if (top + popoverHeight > window.innerHeight - margin) {
      top = rect.top - gap - popoverHeight
    }

    setPosition({ top, left })
  }

  function close() {
    setPopoverState(null)
    setLoading(false)
  }

  async function handleDelete() {
    const state = popoverState()
    if (!state || loading()) return
    setLoading(true)
    try {
      await props.onConfirm(state.entityId)
      close()
    } catch (err: any) {
      showToast(err?.message || 'Delete failed', 'error')
      setLoading(false)
    }
  }

  function handleClickOutside(e: MouseEvent) {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      close()
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }

  createEffect(() => {
    const state = popoverState()
    if (state) {
      computePosition(state.triggerEl)
      // Defer listener attachment to avoid catching the triggering click
      requestAnimationFrame(() => {
        document.addEventListener('mousedown', handleClickOutside)
      })
      document.addEventListener('keydown', handleKeydown)
    } else {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeydown)
    }
  })

  onCleanup(() => {
    document.removeEventListener('mousedown', handleClickOutside)
    document.removeEventListener('keydown', handleKeydown)
  })

  return (
    <Show when={popoverState()}>
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          top: `${position().top}px`,
          left: `${position().left}px`,
          width: '260px',
          'background-color': 'var(--ui-card-bg)',
          border: '1px solid var(--ui-border)',
          'border-radius': 'var(--ui-radius-lg)',
          'box-shadow': 'var(--ui-shadow-lg)',
          'z-index': '80',
          padding: '12px',
          animation: 'ui-fade-scale-in 0.15s ease-out',
        }}
      >
        {/* Title row */}
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-bottom': '4px' }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            style={{ color: 'var(--ui-warning)', 'flex-shrink': '0' }}
          >
            <path
              d="M8.57 3.22 1.8 15a1.65 1.65 0 0 0 1.43 2.5h13.54a1.65 1.65 0 0 0 1.43-2.5L11.43 3.22a1.65 1.65 0 0 0-2.86 0Z"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path d="M10 7.5v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <circle cx="10" cy="13.5" r="0.75" fill="currentColor" />
          </svg>
          <span
            style={{
              'font-size': '13px',
              'font-weight': '500',
              color: 'var(--ui-text)',
            }}
          >
            Delete {props.entityName || 'this item'}?
          </span>
        </div>

        {/* Message */}
        <p
          style={{
            'font-size': '12px',
            color: 'var(--ui-text-muted)',
            'margin-bottom': '12px',
            'margin-top': '0',
            'line-height': '1.4',
          }}
        >
          This action cannot be undone.
        </p>

        {/* Button row */}
        <div style={{ display: 'flex', 'justify-content': 'flex-end', gap: '8px' }}>
          <button class="ui-btn ui-btn-secondary ui-btn-sm" onClick={close} disabled={loading()}>
            Cancel
          </button>
          <button class="ui-btn ui-btn-destructive ui-btn-sm" onClick={handleDelete} disabled={loading()}>
            <Show when={loading()} fallback="Delete">
              Deleting...
            </Show>
          </button>
        </div>
      </div>
    </Show>
  )
}
