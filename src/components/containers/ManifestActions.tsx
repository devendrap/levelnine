import { Show } from 'solid-js'

export default function ManifestActions(props: {
  containerId: string
  containerStatus: string
  allReviewed: boolean
  missingSchemas: number
  totalCount: number
}) {
  const generateSchemas = () => {
    window.location.href = `/containers/${props.containerId}?action=generate-schemas`
  }

  const lockContainer = async () => {
    if (!confirm(`Lock container and deploy all ${props.totalCount} entity types? This cannot be undone.`)) return
    const res = await fetch(`/api/v1/containers/${props.containerId}/lock`, { method: 'POST' })
    if (res.ok) window.location.reload()
    else {
      const err = await res.json()
      alert(err.error)
    }
  }

  return (
    <div class="flex items-center gap-2">
      <Show when={props.containerStatus !== 'locked' && props.missingSchemas > 0}>
        <button
          onClick={generateSchemas}
          class="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity"
          style={{
            "background-color": "rgba(59,143,232,0.12)",
            color: "var(--ui-accent, #3B8FE8)",
            border: "1px solid rgba(59,143,232,0.2)",
          }}
        >
          Generate Schemas ({props.missingSchemas} remaining)
        </button>
      </Show>
      <Show when={props.allReviewed && props.containerStatus !== 'locked'}>
        <button
          onClick={lockContainer}
          class="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity"
          style={{
            "background-color": "rgba(34,197,94,0.12)",
            color: "#22C55E",
            border: "1px solid rgba(34,197,94,0.2)",
          }}
        >
          Lock Container
        </button>
      </Show>
    </div>
  )
}
