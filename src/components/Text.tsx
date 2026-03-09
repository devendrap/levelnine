import { useStore } from '@nanostores/solid'
import { $formData, resolveBindings } from '../stores/ui'

const variants: Record<string, string> = {
  body: 'text-base text-gray-700',
  caption: 'text-sm text-gray-500',
  code: 'font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded text-gray-800',
}

export function Text(props: { content: string; variant?: string }) {
  const formData = useStore($formData)
  const resolved = () => {
    formData() // subscribe to changes
    return resolveBindings(props.content)
  }
  const v = () => props.variant ?? 'body'
  return <p class={variants[v()] ?? variants.body}>{resolved()}</p>
}
