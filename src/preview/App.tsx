import { createSignal, Show } from 'solid-js'
import { ComponentSchema } from '../catalog/schemas'
import { Renderer } from '../renderer/Renderer'

const EXAMPLE = JSON.stringify({
  type: 'Stack', props: { gap: '6' },
  children: [
    { type: 'Heading', props: { level: 1, content: 'Sales Dashboard' } },
    { type: 'Row', props: { gap: '4' },
      children: [
        { type: 'Card', props: { title: 'Revenue', description: '$12,340' },
          children: [{ type: 'Badge', props: { label: '+12%', variant: 'success' } }] },
        { type: 'Card', props: { title: 'Users', description: '1,205' },
          children: [{ type: 'Badge', props: { label: '-3%', variant: 'error' } }] },
        { type: 'Card', props: { title: 'Orders', description: '384' },
          children: [{ type: 'Badge', props: { label: 'new', variant: 'default' } }] },
      ],
    },
    { type: 'Separator', props: {} },
    { type: 'Card', props: { title: 'Quick Actions' },
      children: [
        { type: 'Row', props: { gap: '2' },
          children: [
            { type: 'Button', props: { label: 'Export CSV', variant: 'outline', size: 'sm' } },
            { type: 'Button', props: { label: 'Generate Report', variant: 'default', size: 'sm' } },
          ] },
      ] },
    { type: 'List', props: { ordered: false, items: ['Q1 targets met', '3 new accounts', 'Pipeline review pending'] } },
  ],
}, null, 2)

export function App() {
  const [json, setJson] = createSignal(EXAMPLE)
  const [error, setError] = createSignal<string | null>(null)

  const parsed = () => {
    try {
      const raw = JSON.parse(json())
      const result = ComponentSchema.safeParse(raw)
      if (!result.success) {
        setError(result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n'))
        return null
      }
      setError(null)
      return result.data
    } catch (e: any) {
      setError(e.message)
      return null
    }
  }

  return (
    <div class="flex h-screen bg-gray-50">
      <div class="w-1/2 p-4 flex flex-col">
        <div class="text-sm font-medium text-gray-500 mb-2">JSON Spec</div>
        <textarea
          class="flex-1 font-mono text-sm p-3 border border-gray-300 rounded-lg resize-none bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          value={json()}
          onInput={(e) => setJson(e.currentTarget.value)}
          spellcheck={false}
        />
      </div>
      <div class="w-1/2 p-4 overflow-auto">
        <div class="text-sm font-medium text-gray-500 mb-2">Preview</div>
        <Show when={error()}>
          <pre class="text-red-500 mb-4 text-sm font-mono whitespace-pre-wrap bg-red-50 p-3 rounded-lg border border-red-200">{error()}</pre>
        </Show>
        <Show when={parsed()}>{(node) => <Renderer node={node()} />}</Show>
      </div>
    </div>
  )
}
