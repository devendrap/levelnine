import { createSignal, Show, onMount, onCleanup, type JSX } from 'solid-js'

export function Popover(props: { trigger: string; title?: string; content: string; children?: JSX.Element }) {
  const [open, setOpen] = createSignal(false)
  let containerRef!: HTMLDivElement

  const handleClickOutside = (e: MouseEvent) => {
    if (open() && containerRef && !containerRef.contains(e.target as Node)) setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open()) { e.preventDefault(); setOpen(false) }
  }

  onMount(() => {
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', onKeyDown)
  })
  onCleanup(() => {
    document.removeEventListener('mousedown', handleClickOutside)
    document.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div class="relative inline-flex" ref={containerRef}>
      <button
        type="button"
        class="inline-flex items-center gap-1 text-sm font-medium rounded-lg border px-3 py-2 transition-all duration-150 cursor-pointer"
        style={{
          "background-color": 'var(--ui-bg)',
          "border-color": open() ? 'var(--ui-primary)' : 'var(--ui-border)',
          color: 'var(--ui-text)',
          "box-shadow": open() ? '0 0 0 3px color-mix(in srgb, var(--ui-primary) 15%, transparent)' : 'var(--ui-shadow)',
        }}
        onClick={() => setOpen(!open())}
        aria-expanded={open()}
        aria-haspopup="dialog"
      >
        {props.trigger}
        <svg viewBox="0 0 16 16" fill="none" style={{ width: '14px', height: '14px', color: 'var(--ui-text-muted)' }}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <Show when={open()}>
        <div
          class="absolute top-full left-0 mt-2 rounded-xl border z-50"
          style={{
            "background-color": 'var(--ui-card-bg)',
            "border-color": 'var(--ui-border)',
            "box-shadow": 'var(--ui-shadow-lg)',
            width: '280px',
            animation: 'ui-scale-in 150ms ease-out',
          }}
          role="dialog"
        >
          <Show when={props.title}>
            <div
              class="px-4 py-3 text-sm font-semibold"
              style={{ color: 'var(--ui-text)', "border-bottom": '1px solid var(--ui-border)' }}
            >
              {props.title}
            </div>
          </Show>
          <div class="px-4 py-3 text-sm leading-relaxed" style={{ color: 'var(--ui-text-secondary)' }}>
            {props.content}
            {props.children}
          </div>
          {/* Close */}
          <button
            type="button"
            class="absolute top-2.5 right-2.5 flex items-center justify-center rounded-md cursor-pointer hover:opacity-70 transition-opacity"
            style={{ width: '24px', height: '24px', color: 'var(--ui-text-muted)' }}
            onClick={() => setOpen(false)}
          >
            <svg viewBox="0 0 16 16" fill="none" style={{ width: '14px', height: '14px' }}>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </Show>
    </div>
  )
}
