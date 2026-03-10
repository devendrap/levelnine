const variants: Record<string, Record<string, string>> = {
  default: { "background-color": "var(--ui-bg-muted)", color: "var(--ui-text-secondary)" },
  success: { "background-color": "var(--ui-success-bg)", color: "var(--ui-success)", "border": "1px solid var(--ui-success-border)" },
  warning: { "background-color": "var(--ui-warning-bg)", color: "var(--ui-warning)", "border": "1px solid var(--ui-warning-border)" },
  error: { "background-color": "var(--ui-error-bg)", color: "var(--ui-error)", "border": "1px solid var(--ui-error-border)" },
}

export function Badge(props: { label: string; variant?: string }) {
  return (
    <span
      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={variants[props.variant ?? 'default']}
    >
      {props.label}
    </span>
  )
}
