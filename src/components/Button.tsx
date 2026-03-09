import { runAction } from '../stores/ui'

const variants: Record<string, Record<string, string>> = {
  default: { "background-color": "var(--ui-text)", color: "var(--ui-bg)" },
  outline: { "background-color": "transparent", color: "var(--ui-text-secondary)", "border": "1px solid var(--ui-border)" },
  ghost: { "background-color": "transparent", color: "var(--ui-text-secondary)" },
}

const sizes: Record<string, string> = {
  sm: 'px-2.5 py-1 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
}

export function Button(props: { label: string; variant?: string; size?: string; action?: string }) {
  return (
    <button
      class={`inline-flex items-center justify-center rounded-md font-medium transition-colors cursor-pointer hover:opacity-80 ${sizes[props.size ?? 'md']}`}
      style={variants[props.variant ?? 'default']}
      onClick={() => props.action && runAction(props.action)}
    >
      {props.label}
    </button>
  )
}
