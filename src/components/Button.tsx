import { runAction } from '../stores/ui'

const variants: Record<string, string> = {
  default: 'bg-gray-900 text-white hover:bg-gray-800',
  outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
  ghost: 'text-gray-700 hover:bg-gray-100',
}

const sizes: Record<string, string> = {
  sm: 'px-2.5 py-1 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
}

export function Button(props: { label: string; variant?: string; size?: string; action?: string }) {
  return (
    <button
      class={`inline-flex items-center justify-center rounded-md font-medium transition-colors cursor-pointer ${variants[props.variant ?? 'default']} ${sizes[props.size ?? 'md']}`}
      onClick={() => props.action && runAction(props.action)}
    >
      {props.label}
    </button>
  )
}
