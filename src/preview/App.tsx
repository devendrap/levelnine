import { createSignal, Show } from 'solid-js'
import { useStore } from '@nanostores/solid'
import { ComponentSchema } from '../catalog/schemas'
import { Renderer } from '../renderer/Renderer'
import { $theme } from '../stores/ui'

const EXAMPLE = JSON.stringify({
  type: 'Stack', props: { gap: '4' },
  children: [
    { type: 'Heading', props: { level: 2, content: 'Sign Up' } },
    { type: 'Input', props: { label: 'Name', placeholder: 'Enter your name', bind: 'name' } },
    { type: 'Input', props: { label: 'Email', placeholder: 'you@example.com', type: 'email', bind: 'email' } },
    { type: 'Row', props: { gap: '2' },
      children: [
        { type: 'Button', props: { label: 'Submit', variant: 'default', action: 'submit' } },
        { type: 'Button', props: { label: 'Toggle Dark Mode', variant: 'ghost', action: 'toggleTheme' } },
      ] },
    { type: 'Text', props: { content: 'Hello, $name', variant: 'caption' } },
  ],
}, null, 2)

export function App() {
  const [json, setJson] = createSignal(EXAMPLE)
  const [error, setError] = createSignal<string | null>(null)
  const theme = useStore($theme)

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
        <div class={`rounded-lg p-4 transition-colors ${theme() === 'dark' ? 'bg-gray-900 text-white' : 'bg-white'}`}>
          <Show when={parsed()}>{(node) => <Renderer node={node()} />}</Show>
        </div>
      </div>
    </div>
  )
}
