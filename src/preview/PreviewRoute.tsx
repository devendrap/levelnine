import { createResource, Show } from 'solid-js'
import { useStore } from '@nanostores/solid'
import { Renderer } from '../renderer/Renderer'
import { ComponentSchema } from '../catalog/schemas'
import { $theme } from '../stores/ui'

async function fetchSpec(id: string) {
  const res = await fetch(`/api/preview/${id}`)
  if (!res.ok) return null
  const raw = await res.json()
  const result = ComponentSchema.safeParse(raw)
  return result.success ? result.data : null
}

export function PreviewRoute(props: { id: string }) {
  const [spec] = createResource(() => props.id, fetchSpec)
  const theme = useStore($theme)

  return (
    <div class={`min-h-screen p-8 transition-colors ${theme() === 'dark' ? 'dark' : ''}`} style={{ "background-color": "var(--ui-bg)" }}>
      <Show when={spec.loading}>
        <p class="text-sm" style={{ color: "var(--ui-text-muted)" }}>Loading preview...</p>
      </Show>
      <Show when={spec.error}>
        <p class="text-red-500 text-sm">Failed to load preview</p>
      </Show>
      <Show when={spec()}>{(node) => <Renderer node={node()} />}</Show>
      <Show when={!spec.loading && !spec() && !spec.error}>
        <p class="text-red-500 text-sm">Preview not found</p>
      </Show>
    </div>
  )
}
