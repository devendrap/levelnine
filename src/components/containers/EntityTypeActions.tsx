import { createSignal, Show } from 'solid-js'
import ConfirmDialog from './ConfirmDialog'
import { showToast } from './Toast'

export default function EntityTypeActions(props: {
  containerId: string
  entityName: string
  reviewed: boolean
  hasSchema: boolean
}) {
  const [confirmOpen, setConfirmOpen] = createSignal(false)

  const apiCall = async (url: string, method: string, body?: any) => {
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (res.ok) window.location.reload()
      else {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        showToast(err.error)
      }
    } catch {
      showToast('Network error')
    }
  }

  const enhance = () => {
    window.location.href = `/containers/${props.containerId}?enhance=${encodeURIComponent(props.entityName)}`
  }

  const review = () =>
    apiCall(`/api/v1/containers/${props.containerId}/review`, 'POST', { names: [props.entityName] })

  const remove = () => setConfirmOpen(true)

  const doRemove = () => {
    setConfirmOpen(false)
    apiCall(`/api/v1/containers/${props.containerId}/entity-types`, 'DELETE', { names: [props.entityName] })
  }

  const unlock = () =>
    apiCall(`/api/v1/containers/${props.containerId}/unlock`, 'POST', { name: props.entityName })

  return (
    <>
      <div class="flex items-center gap-1.5 ml-4 shrink-0">
        <Show when={!props.reviewed}>
          <button
            onClick={enhance}
            class="px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
            style={{ "background-color": "rgba(59,143,232,0.08)", color: "var(--ui-accent, #3B8FE8)" }}
            title="Refine this entity type in chat"
          >
            Enhance
          </button>
          <button
            onClick={review}
            class="px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
            style={{ "background-color": "rgba(34,197,94,0.08)", color: "#22C55E" }}
            title={props.hasSchema ? 'Mark as reviewed' : 'Needs a schema before reviewing'}
          >
            Review
          </button>
          <button
            onClick={remove}
            class="px-2.5 py-1.5 rounded-md text-[11px] cursor-pointer hover:opacity-80 transition-opacity"
            style={{ color: "rgba(239,68,68,0.7)" }}
            title="Remove from manifest"
          >
            Remove
          </button>
        </Show>
        <Show when={props.reviewed}>
          <button
            onClick={unlock}
            class="px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
            style={{ color: "var(--ui-text-muted)", "background-color": "rgba(240,237,232,0.04)" }}
            title="Unlock for editing"
          >
            Unlock
          </button>
        </Show>
      </div>

      <ConfirmDialog
        open={confirmOpen()}
        title="Remove Entity Type"
        message={`Remove "${props.entityName}" from the manifest? This will delete its schema.`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={doRemove}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
