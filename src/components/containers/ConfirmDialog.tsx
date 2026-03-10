import { Show } from 'solid-js'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'warning' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog(props: ConfirmDialogProps) {
  const iconColor = () => props.variant === 'danger' ? '#EF4444' : '#EAB308'
  const iconBg = () => props.variant === 'danger' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)'
  const confirmBg = () => props.variant === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)'
  const confirmFg = () => props.variant === 'danger' ? '#EF4444' : '#EAB308'
  const confirmBorder = () => props.variant === 'danger' ? 'rgba(239,68,68,0.25)' : 'rgba(234,179,8,0.25)'

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        style={{ 'background-color': 'rgba(0,0,0,0.6)', 'backdrop-filter': 'blur(4px)' }}
        onClick={props.onCancel}
      >
        <div
          class="rounded-xl p-6 w-full max-w-sm shadow-2xl"
          style={{
            'background-color': 'var(--ui-card-bg)',
            border: '1px solid var(--ui-border)',
            'box-shadow': '0 24px 48px rgba(0,0,0,0.4)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            class="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
            style={{ 'background-color': iconBg() }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor()} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <h3 class="text-sm font-semibold mb-1.5" style={{ color: 'var(--ui-text)' }}>
            {props.title}
          </h3>
          <p class="text-xs leading-relaxed mb-5" style={{ color: 'var(--ui-text-muted)' }}>
            {props.message}
          </p>

          <div class="flex items-center justify-end gap-2">
            <button
              onClick={props.onCancel}
              class="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
              style={{ color: 'var(--ui-text-muted)', 'background-color': 'rgba(240,237,232,0.06)', border: '1px solid var(--ui-border)' }}
            >
              {props.cancelLabel ?? 'Cancel'}
            </button>
            <button
              onClick={props.onConfirm}
              class="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity"
              style={{
                'background-color': confirmBg(),
                color: confirmFg(),
                border: `1px solid ${confirmBorder()}`,
              }}
            >
              {props.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}
