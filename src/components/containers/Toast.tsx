import { createSignal, Show, onCleanup } from 'solid-js'

export type ToastVariant = 'error' | 'success' | 'info'

interface ToastState {
  message: string
  variant: ToastVariant
}

const [toast, setToast] = createSignal<ToastState | null>(null)
let timeout: ReturnType<typeof setTimeout> | undefined

export function showToast(message: string, variant: ToastVariant = 'error', duration = 4000) {
  if (timeout) clearTimeout(timeout)
  setToast({ message, variant })
  timeout = setTimeout(() => setToast(null), duration)
}

export function dismissToast() {
  if (timeout) clearTimeout(timeout)
  setToast(null)
}

export default function Toast() {
  const colors = {
    error: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', fg: '#EF4444' },
    success: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)', fg: '#22C55E' },
    info: { bg: 'rgba(59,143,232,0.12)', border: 'rgba(59,143,232,0.25)', fg: '#3B8FE8' },
  }

  const c = () => colors[toast()?.variant ?? 'error']

  const icon = () => {
    const v = toast()?.variant
    if (v === 'success') return '\u2713'
    if (v === 'info') return '\u2139'
    return '\u2717'
  }

  onCleanup(() => { if (timeout) clearTimeout(timeout) })

  return (
    <Show when={toast()}>
      <div
        class="fixed bottom-6 right-6 z-50 flex items-center gap-3 pl-4 pr-3 py-3 rounded-xl shadow-lg max-w-sm"
        style={{
          'background-color': c().bg,
          border: `1px solid ${c().border}`,
          'backdrop-filter': 'blur(12px)',
          'box-shadow': '0 8px 24px rgba(0,0,0,0.3)',
        }}
      >
        <span class="text-sm font-bold shrink-0" style={{ color: c().fg }}>{icon()}</span>
        <span class="text-xs leading-relaxed" style={{ color: 'var(--ui-text)' }}>
          {toast()!.message}
        </span>
        <button
          onClick={dismissToast}
          class="shrink-0 w-5 h-5 rounded flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity"
          style={{ color: 'var(--ui-text-muted)', background: 'none', border: 'none' }}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </Show>
  )
}
