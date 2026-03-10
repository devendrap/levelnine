import { createSignal, Show, onMount, onCleanup } from 'solid-js'
import type { JSX } from 'solid-js'

export function Dialog(props: { title: string; open?: boolean; trigger?: string; children?: JSX.Element }) {
  const [visible, setVisible] = createSignal(props.open ?? false)

  const close = () => setVisible(false)

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && visible()) close()
  }

  onMount(() => document.addEventListener('keydown', onKeyDown))
  onCleanup(() => document.removeEventListener('keydown', onKeyDown))

  return (
    <>
      {/* Trigger button — always visible when dialog is closed */}
      <Show when={props.trigger || !props.open}>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-150 cursor-pointer"
          style={{
            "background-color": "var(--ui-bg)",
            "border-color": "var(--ui-border)",
            color: "var(--ui-text)",
            "box-shadow": "var(--ui-shadow)",
          }}
          onClick={() => setVisible(true)}
        >
          {props.trigger ?? props.title}
        </button>
      </Show>

      {/* Modal overlay */}
      <Show when={visible()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            "background-color": "rgba(0,0,0,0.5)",
            animation: "ui-fade-in 150ms ease-out",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) close() }}
        >
          <div
            class="rounded-xl border p-6 shadow-lg w-full max-w-md mx-4 relative"
            style={{
              "background-color": "var(--ui-card-bg)",
              "border-color": "var(--ui-border)",
              "box-shadow": "var(--ui-shadow-lg)",
              animation: "ui-scale-in 200ms ease-out",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            {/* Header */}
            <div class="flex items-center justify-between mb-4">
              <h2 id="dialog-title" class="text-lg font-semibold" style={{ color: "var(--ui-text)" }}>
                {props.title}
              </h2>
              <button
                type="button"
                class="flex items-center justify-center rounded-md cursor-pointer hover:opacity-70 transition-opacity"
                style={{ width: "28px", height: "28px", color: "var(--ui-text-muted)" }}
                onClick={close}
                aria-label="Close dialog"
              >
                <svg viewBox="0 0 16 16" fill="none" style={{ width: "14px", height: "14px" }}>
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                </svg>
              </button>
            </div>

            {/* Content */}
            {props.children}
          </div>
        </div>
      </Show>
    </>
  )
}
