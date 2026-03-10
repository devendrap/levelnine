import { For, createSignal } from 'solid-js'

export function Accordion(props: { items: { title: string; content: string }[]; multiple?: boolean }) {
  const [openSet, setOpenSet] = createSignal<Set<number>>(new Set())

  const toggle = (idx: number) => {
    setOpenSet((prev) => {
      const next = new Set(props.multiple ? prev : [])
      if (prev.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const onKeyDown = (idx: number, e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(idx) }
  }

  return (
    <div
      class="rounded-lg border overflow-hidden"
      style={{ "border-color": 'var(--ui-border)', "background-color": 'var(--ui-bg)' }}
    >
      <For each={props.items}>
        {(item, idx) => {
          const isOpen = () => openSet().has(idx())
          let contentRef!: HTMLDivElement
          return (
            <div style={{ "border-top": idx() > 0 ? '1px solid var(--ui-border)' : 'none' }}>
              {/* Header */}
              <button
                type="button"
                role="button"
                aria-expanded={isOpen()}
                tabIndex={0}
                class="flex w-full items-center justify-between px-4 py-3.5 text-sm font-medium cursor-pointer transition-colors duration-100"
                style={{
                  color: 'var(--ui-text)',
                  "background-color": isOpen() ? 'var(--ui-bg-subtle)' : 'transparent',
                }}
                onClick={() => toggle(idx())}
                onKeyDown={(e) => onKeyDown(idx(), e)}
              >
                <span class="text-left flex-1">{item.title}</span>
                <span
                  class="flex items-center justify-center rounded-full transition-all duration-200"
                  style={{
                    width: '24px',
                    height: '24px',
                    "background-color": isOpen() ? 'var(--ui-bg-muted)' : 'transparent',
                    transform: isOpen() ? 'rotate(180deg)' : 'rotate(0deg)',
                    "flex-shrink": '0',
                    "margin-left": '12px',
                  }}
                >
                  <svg viewBox="0 0 16 16" fill="none" style={{ width: '12px', height: '12px', color: 'var(--ui-text-muted)' }}>
                    <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </span>
              </button>
              {/* Content */}
              <div
                ref={contentRef}
                class="overflow-hidden transition-all duration-200"
                style={{
                  "max-height": isOpen() ? `${contentRef?.scrollHeight ?? 200}px` : '0px',
                  opacity: isOpen() ? '1' : '0',
                }}
              >
                <div
                  class="px-4 pb-4 pt-1 text-sm leading-relaxed"
                  style={{ color: 'var(--ui-text-secondary)' }}
                >
                  {item.content}
                </div>
              </div>
            </div>
          )
        }}
      </For>
    </div>
  )
}
