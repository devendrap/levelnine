import { createSignal, Show, For, onMount, onCleanup, type JSX } from 'solid-js'
import { runAction } from '../stores/ui'

type MenuItem = { label: string; action?: string; variant?: string }

export function ContextMenu(props: { items: MenuItem[]; children?: JSX.Element }) {
  const [open, setOpen] = createSignal(false)
  const [pos, setPos] = createSignal({ x: 0, y: 0 })
  let containerRef!: HTMLDivElement

  const handleContext = (e: MouseEvent) => {
    e.preventDefault()
    const rect = containerRef.getBoundingClientRect()
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setOpen(true)
  }

  const handleClickOutside = (e: MouseEvent) => {
    if (open() && containerRef && !containerRef.contains(e.target as Node)) setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open()) setOpen(false)
  }

  onMount(() => {
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', onKeyDown)
  })
  onCleanup(() => {
    document.removeEventListener('mousedown', handleClickOutside)
    document.removeEventListener('keydown', onKeyDown)
  })

  const handleAction = (item: MenuItem) => {
    if (item.action) runAction(item.action)
    setOpen(false)
  }

  return (
    <div
      class="relative"
      ref={containerRef}
      onContextMenu={handleContext}
    >
      {/* Render children or a default right-click zone */}
      <Show when={props.children} fallback={
        <div
          class="flex items-center justify-center rounded-lg border border-dashed px-6 py-4 text-sm"
          style={{
            "border-color": 'var(--ui-border)',
            color: 'var(--ui-text-muted)',
            "min-height": '80px',
          }}
        >
          Right-click for options
        </div>
      }>
        {props.children}
      </Show>

      <Show when={open()}>
        <div
          class="absolute rounded-lg border overflow-hidden z-50"
          style={{
            left: `${pos().x}px`,
            top: `${pos().y}px`,
            "background-color": 'var(--ui-card-bg)',
            "border-color": 'var(--ui-border)',
            "box-shadow": 'var(--ui-shadow-lg)',
            "min-width": '160px',
            animation: 'ui-scale-in 100ms ease-out',
          }}
          role="menu"
        >
          <div class="py-1">
            <For each={props.items}>
              {(item) => {
                if (item.label === '---') {
                  return <div class="my-1" style={{ "border-top": '1px solid var(--ui-border)' }} />
                }
                return (
                  <button
                    type="button"
                    class="flex w-full items-center px-3 py-2 text-sm cursor-pointer transition-colors duration-75 hover:opacity-80"
                    style={{
                      color: item.variant === 'danger' ? 'var(--ui-error)' : 'var(--ui-text)',
                      "background-color": 'transparent',
                    }}
                    role="menuitem"
                    onClick={() => handleAction(item)}
                  >
                    {item.label}
                  </button>
                )
              }}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}
