import { useStore } from '@nanostores/solid'
import { $formData } from '../stores/ui'

const variants: Record<string, string> = {
  body: 'text-base',
  caption: 'text-sm',
  code: 'font-mono text-sm px-1.5 py-0.5 rounded',
}

const variantColors: Record<string, string> = {
  body: 'var(--ui-text-secondary)',
  caption: 'var(--ui-text-muted)',
  code: 'var(--ui-text)',
}

export function Text(props: { content?: string; text?: string; variant?: string }) {
  const formData = useStore($formData)
  const resolved = () =>
    (props.content ?? props.text ?? '').replace(/\$(\w+)/g, (_, key) => formData()[key] ?? '')
  const v = () => props.variant ?? 'body'
  return (
    <p
      class={variants[v()] ?? variants.body}
      style={{
        color: variantColors[v()] ?? variantColors.body,
        ...(v() === 'code' ? { "background-color": "var(--ui-bg-muted)" } : {}),
      }}
    >
      {resolved()}
    </p>
  )
}
