import { Show, type JSX } from 'solid-js'

const variants: Record<string, { bg: string; border: string; icon: string; accent: string }> = {
  info: {
    bg: 'var(--ui-info-bg)',
    border: 'var(--ui-info-border)',
    accent: 'var(--ui-info)',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
  },
  success: {
    bg: 'var(--ui-success-bg)',
    border: 'var(--ui-success-border)',
    accent: 'var(--ui-success)',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  },
  warning: {
    bg: 'var(--ui-warning-bg)',
    border: 'var(--ui-warning-border)',
    accent: 'var(--ui-warning)',
    icon: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  },
  error: {
    bg: 'var(--ui-error-bg)',
    border: 'var(--ui-error-border)',
    accent: 'var(--ui-error)',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
  },
}

export function Alert(props: { title?: string; message: string; variant?: string; children?: JSX.Element }) {
  const v = () => variants[props.variant ?? 'info'] ?? variants.info

  return (
    <div
      class="rounded-lg border px-4 py-3.5"
      style={{
        "background-color": v().bg,
        "border-color": v().border,
        "border-left": `3px solid ${v().accent}`,
      }}
    >
      <div class="flex gap-3">
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{
            width: '20px',
            height: '20px',
            color: v().accent,
            "flex-shrink": '0',
            "margin-top": '1px',
          }}
        >
          <path d={v().icon} />
        </svg>
        <div class="flex flex-col gap-1 flex-1 min-w-0">
          <Show when={props.title}>
            <p class="text-sm font-semibold leading-tight" style={{ color: 'var(--ui-text)' }}>{props.title}</p>
          </Show>
          <p class="text-sm leading-relaxed" style={{ color: 'var(--ui-text-secondary)' }}>{props.message}</p>
          {props.children}
        </div>
      </div>
    </div>
  )
}
