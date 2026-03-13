import { createSignal, createEffect, Show, onCleanup } from 'solid-js'

export type ToastVariant = 'error' | 'success' | 'info' | 'warning'

interface ToastState {
  message: string
  variant: ToastVariant
  duration: number
}

const [toast, setToast] = createSignal<ToastState | null>(null)
const [progress, setProgress] = createSignal(100)
let timeout: ReturnType<typeof setTimeout> | undefined
let progressInterval: ReturnType<typeof setInterval> | undefined

function clearTimers() {
  if (timeout) clearTimeout(timeout)
  if (progressInterval) clearInterval(progressInterval)
}

export function showToast(message: string, variant: ToastVariant = 'error', duration = 4000) {
  clearTimers()
  setToast({ message, variant, duration })
  setProgress(100)

  const stepMs = 30
  const decrement = (100 / duration) * stepMs
  progressInterval = setInterval(() => {
    setProgress(p => {
      const next = p - decrement
      if (next <= 0) {
        clearInterval(progressInterval!)
        return 0
      }
      return next
    })
  }, stepMs)

  timeout = setTimeout(() => {
    clearTimers()
    setToast(null)
  }, duration)
}

export function dismissToast() {
  clearTimers()
  setToast(null)
}

export default function Toast() {
  const variantStyles: Record<ToastVariant, { bg: string; border: string; fg: string }> = {
    error:   { bg: 'var(--ui-error-bg)',   border: 'var(--ui-error-border)',   fg: 'var(--ui-error)' },
    success: { bg: 'var(--ui-success-bg)', border: 'var(--ui-success-border)', fg: 'var(--ui-success)' },
    info:    { bg: 'var(--ui-info-bg)',     border: 'var(--ui-info-border)',     fg: 'var(--ui-info)' },
    warning: { bg: 'var(--ui-warning-bg)', border: 'var(--ui-warning-border)', fg: 'var(--ui-warning)' },
  }

  const c = () => variantStyles[toast()?.variant ?? 'error']

  const icon = () => {
    const v = toast()?.variant
    if (v === 'success') return '\u2713'
    if (v === 'info') return '\u2139'
    if (v === 'warning') return '\u26A0'
    return '\u2717'
  }

  onCleanup(() => clearTimers())

  return (
    <Show when={toast()}>
      <div
        class="group fixed top-6 right-6 z-50 flex flex-col rounded-xl shadow-lg max-w-sm overflow-hidden"
        style={{
          'background-color': c().bg,
          border: `1px solid ${c().border}`,
          'backdrop-filter': 'blur(12px)',
          'box-shadow': '0 8px 24px rgba(0,0,0,0.3)',
          animation: 'ui-toast-slide-in 0.3s ease-out',
        }}
      >
        <div class="flex items-center gap-3 pl-4 pr-3 py-3">
          <span class="text-sm font-bold shrink-0" style={{ color: c().fg }}>{icon()}</span>
          <span class="text-xs leading-relaxed flex-1" style={{ color: 'var(--ui-text)' }}>
            {toast()!.message}
          </span>
          <button
            onClick={dismissToast}
            class="shrink-0 w-5 h-5 rounded flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: 'var(--ui-text-muted)', background: 'none', border: 'none' }}
            aria-label="Dismiss notification"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        {/* Progress bar */}
        <div
          style={{
            height: '2px',
            width: `${progress()}%`,
            'background-color': c().fg,
            transition: 'width 30ms linear',
          }}
        />
      </div>
    </Show>
  )
}
