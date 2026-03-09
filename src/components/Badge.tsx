const variants: Record<string, Record<string, string>> = {
  default: { "background-color": "var(--ui-bg-muted)", color: "var(--ui-text-secondary)" },
  success: { "background-color": "#dcfce7", color: "#166534" },
  warning: { "background-color": "#fef9c3", color: "#854d0e" },
  error: { "background-color": "#fee2e2", color: "#991b1b" },
}

export function Badge(props: { label: string; variant?: string }) {
  return (
    <span
      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={variants[props.variant ?? 'default']}
    >
      {props.label}
    </span>
  )
}
