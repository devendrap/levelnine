import { createResource, createSignal, Show } from 'solid-js'
import { useStore } from '@nanostores/solid'
import { Renderer } from '../renderer/Renderer'
import { $theme, $formData } from '../stores/ui'
import type { UIComponent } from '../renderer/types'

interface EntityData {
  id: string
  name: string
  status: string
  content: Record<string, any>
  entity_type?: {
    name: string
    description: string | null
    schema: any
  }
}

async function fetchEntity(id: string): Promise<EntityData | null> {
  const res = await fetch(`/api/v1/entities/${id}`)
  if (!res.ok) return null
  return res.json()
}

function hydrateSpec(spec: any, content: Record<string, any>): any {
  if (!spec) return null
  const json = JSON.stringify(spec)
  // Replace $bind references with content values and populate $formData
  const hydrated = json.replace(/\$\{(\w+)\}/g, (_: string, key: string) => {
    return content[key] ?? ''
  })
  return JSON.parse(hydrated)
}

export default function EntityEditorIsland(props: { id: string }) {
  const theme = useStore($theme)
  const [saving, setSaving] = createSignal(false)
  const [saveMsg, setSaveMsg] = createSignal('')

  const [entity, { refetch }] = createResource(() => props.id, fetchEntity)

  // When entity loads, populate $formData with content
  const spec = (): UIComponent | null => {
    const e = entity()
    if (!e?.entity_type?.schema) return null

    // Seed formData from entity content
    const content = e.content ?? {}
    for (const [key, val] of Object.entries(content)) {
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        $formData.setKey(key, String(val))
      }
    }

    return hydrateSpec(e.entity_type.schema, content) as UIComponent
  }

  const save = async () => {
    const e = entity()
    if (!e) return

    setSaving(true)
    setSaveMsg('')

    // Collect current formData as content
    const content = { ...e.content, ...$formData.get() }

    try {
      const res = await fetch(`/api/v1/entities/${e.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const data = await res.json()
        setSaveMsg(`Error: ${data.error}`)
      } else {
        setSaveMsg('Saved')
        refetch()
        setTimeout(() => setSaveMsg(''), 2000)
      }
    } catch {
      setSaveMsg('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      class={`min-h-screen transition-colors ${theme() === 'dark' ? 'dark' : ''}`}
      style={{ "background-color": "var(--ui-bg)", "font-family": "var(--ui-font)" }}
    >
      {/* Header bar */}
      <div
        class="sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b"
        style={{ "background-color": "var(--ui-card-bg)", "border-color": "var(--ui-border)" }}
      >
        <div class="flex items-center gap-3">
          <a href="/dashboard" class="text-sm hover:underline" style={{ color: "var(--ui-text-muted)" }}>← Dashboard</a>
          <Show when={entity()}>
            <span class="text-sm font-medium" style={{ color: "var(--ui-text)" }}>{entity()!.name}</span>
            <span
              class="px-2 py-0.5 rounded text-xs font-medium"
              style={{ "background-color": "var(--ui-primary-light)", color: "var(--ui-primary)" }}
            >
              {entity()!.status}
            </span>
          </Show>
        </div>

        <div class="flex items-center gap-3">
          <Show when={saveMsg()}>
            <span class="text-xs" style={{ color: saveMsg().startsWith('Error') ? 'var(--ui-error)' : 'var(--ui-success)' }}>
              {saveMsg()}
            </span>
          </Show>
          <button
            onClick={save}
            disabled={saving()}
            class="px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ "background-color": "var(--ui-primary)", color: "#0B0F1A" }}
          >
            {saving() ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div class="max-w-5xl mx-auto px-6 py-8">
        <Show when={entity.loading}>
          <p class="text-sm" style={{ color: "var(--ui-text-muted)" }}>Loading...</p>
        </Show>

        <Show when={entity() && !entity()!.entity_type?.schema}>
          <div class="space-y-4">
            <p class="text-sm" style={{ color: "var(--ui-text-muted)" }}>
              No schema defined for entity type "{entity()!.entity_type?.name}". Showing raw content:
            </p>
            <pre
              class="p-4 rounded-lg text-sm overflow-auto"
              style={{ "background-color": "var(--ui-bg-muted)", color: "var(--ui-text)", "font-family": "var(--ui-font-mono)" }}
            >
              {JSON.stringify(entity()!.content, null, 2)}
            </pre>
          </div>
        </Show>

        <Show when={spec()}>
          {(node) => <Renderer node={node()} />}
        </Show>

        <Show when={!entity.loading && !entity()}>
          <p class="text-sm" style={{ color: "var(--ui-error)" }}>Entity not found</p>
        </Show>
      </div>
    </div>
  )
}
