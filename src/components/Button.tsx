import { runAction } from '../stores/ui'

const variants: Record<string, Record<string, string>> = {
  default: { "background-color": "var(--ui-primary)", color: "#ffffff" },
  outline: { "background-color": "transparent", color: "var(--ui-text)", "border": "1px solid var(--ui-border)" },
  ghost: { "background-color": "transparent", color: "var(--ui-text-secondary)" },
}

const sizes: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

export function Button(props: { label: string; variant?: string; size?: string; action?: string }) {
  return (
    <button
      class={`inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 cursor-pointer hover:opacity-85 ${sizes[props.size ?? 'md']}`}
      style={{
        ...variants[props.variant ?? 'default'],
        "box-shadow": props.variant === 'default' || !props.variant ? 'var(--ui-shadow)' : 'none',
      }}
      onClick={() => props.action && runAction(props.action)}
    >
      {props.label}
    </button>
  )
}
