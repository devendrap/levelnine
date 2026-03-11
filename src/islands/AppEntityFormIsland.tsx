import { createSignal, onMount, Show, For } from 'solid-js'
import { useStore } from '@nanostores/solid'
import { $formData, resetFormData, seedFormData } from '../stores/ui'
import { Renderer } from '../renderer/Renderer'

type TransitionInfo = { to: string; role?: string; conditions?: string; allowed: boolean; reason?: string }

export default function AppEntityFormIsland(props: {
  containerId: string
  slug: string
  typeName: string
  entityTypeId: string
  schema: Record<string, any>
  /** For edit mode */
  entityId?: string
  entityName?: string
  entityContent?: Record<string, any>
  entityStatus?: string
  /** read-only view */
  readOnly?: boolean
}) {
  const formData = useStore($formData)
  const [name, setName] = createSignal(props.entityName ?? '')
  const [status, setStatus] = createSignal(props.entityStatus ?? 'draft')
  const [saving, setSaving] = createSignal(false)
  const [error, setError] = createSignal('')
  const [saved, setSaved] = createSignal(false)

  // Workflow state
  const [workflowStatuses, setWorkflowStatuses] = createSignal<string[]>([])
  const [transitions, setTransitions] = createSignal<TransitionInfo[]>([])
  const [hasWorkflow, setHasWorkflow] = createSignal(false)

  const isEdit = !!props.entityId
  const label = props.typeName.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())

  // Default statuses when no workflow defined
  const defaultStatuses = ['draft', 'active', 'review', 'approved', 'archived']

  const fetchWorkflow = async (currentStatus: string) => {
    try {
      const res = await fetch(
        `/api/v1/containers/${props.containerId}/workflows/${props.typeName}?status=${currentStatus}`,
      )
      if (!res.ok) return
      const info = await res.json()
      setHasWorkflow(info.hasWorkflow)
      if (info.hasWorkflow) {
        setWorkflowStatuses(info.statuses ?? [])
        setTransitions(info.transitions ?? [])
      }
    } catch { /* use defaults */ }
  }

  onMount(() => {
    if (isEdit && props.entityContent) {
      seedFormData(props.entityContent)
    } else {
      resetFormData()
    }
    // Fetch workflow transitions for current status
    if (isEdit && props.entityStatus) {
      fetchWorkflow(props.entityStatus)
    }
  })

  // Compute which statuses to show in dropdown
  const availableStatuses = () => {
    if (!hasWorkflow()) return defaultStatuses
    const current = props.entityStatus ?? status()
    const allowed = transitions().map(t => t.to)
    // Always include current status + allowed transitions
    const set = new Set([current, ...allowed])
    // Order by workflow statuses order
    return workflowStatuses().filter(s => set.has(s))
  }

  // Check if a status option is disabled (transition exists but role too low)
  const isStatusDisabled = (s: string) => {
    if (s === (props.entityStatus ?? status())) return false // current status always selectable
    if (!hasWorkflow()) return false
    const t = transitions().find(t => t.to === s)
    return t ? !t.allowed : true
  }

  const statusHint = (s: string) => {
    if (!hasWorkflow()) return undefined
    const t = transitions().find(t => t.to === s)
    return t?.reason
  }

  const save = async () => {
    if (!name().trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const content = { ...formData() }

      if (isEdit) {
        const res = await fetch(`/api/v1/entities/${props.entityId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name(), status: status(), content }),
        })
        if (!res.ok) {
          const err = await res.json()
          setError(err.error ?? 'Save failed')
          return
        }
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        // Re-fetch transitions for new status
        if (status() !== props.entityStatus) {
          fetchWorkflow(status())
        }
      } else {
        const res = await fetch('/api/v1/entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity_type_id: props.entityTypeId,
            container_id: props.containerId,
            name: name(),
            content,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          setError(err.error ?? 'Create failed')
          return
        }
        const data = await res.json()
        window.location.href = `/apps/${props.slug}/${props.typeName}/${data.id}`
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div class="max-w-4xl mx-auto px-8 py-8">
      {/* Top bar */}
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3 min-w-0">
          <a
            href={`/apps/${props.slug}/${props.typeName}`}
            class="text-xs hover:opacity-80 transition-opacity"
            style={{ color: "var(--ui-text-muted)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </a>
          <h1 class="text-lg font-bold truncate" style={{ color: "var(--ui-text)" }}>
            {isEdit ? name() || label : `New ${label}`}
          </h1>
          <Show when={isEdit}>
            <span
              class="text-[11px] px-2 py-0.5 rounded-full font-medium"
              style={{
                "background-color": status() === 'approved' ? 'var(--ui-success-bg)' :
                  status() === 'review' ? 'var(--ui-warning-bg)' : 'rgba(240,237,232,0.06)',
                color: status() === 'approved' ? 'var(--ui-success)' :
                  status() === 'review' ? 'var(--ui-warning)' : 'var(--ui-text-muted)',
              }}
            >
              {status()}
            </span>
          </Show>
        </div>
        <Show when={!props.readOnly}>
          <div class="flex items-center gap-2">
            <Show when={error()}>
              <span class="text-xs" style={{ color: "var(--ui-error)" }}>{error()}</span>
            </Show>
            <Show when={saved()}>
              <span class="text-xs" style={{ color: "var(--ui-success)" }}>Saved</span>
            </Show>
            <button
              onClick={save}
              disabled={saving()}
              class="px-5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:opacity-90 disabled:opacity-40"
              style={{ "background-color": "var(--ui-primary)", color: "#0B0F1A" }}
            >
              {saving() ? 'Saving...' : isEdit ? 'Save Changes' : `Create ${label}`}
            </button>
          </div>
        </Show>
      </div>

      {/* Name + Status row */}
      <div
        class="rounded-xl p-5 mb-6"
        style={{ "background-color": "var(--ui-bg-subtle)", border: "1px solid var(--ui-border)" }}
      >
        <div class="flex gap-4">
          <div class="flex-1">
            <label class="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--ui-text-muted)" }}>
              Name
            </label>
            <input
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder={`Enter ${label.toLowerCase()} name...`}
              disabled={props.readOnly}
              class="w-full bg-transparent outline-none text-sm px-3 py-2 rounded-lg"
              style={{
                color: "var(--ui-text)",
                border: "1px solid var(--ui-border)",
                "background-color": "rgba(240,237,232,0.02)",
              }}
            />
          </div>
          <Show when={isEdit}>
            <div style={{ width: "180px" }}>
              <label class="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--ui-text-muted)" }}>
                Status
              </label>
              <select
                value={status()}
                onChange={(e) => setStatus(e.currentTarget.value)}
                disabled={props.readOnly}
                class="w-full bg-transparent outline-none text-sm px-3 py-2 rounded-lg cursor-pointer"
                style={{
                  color: "var(--ui-text)",
                  border: "1px solid var(--ui-border)",
                  "background-color": "var(--ui-bg-subtle)",
                }}
              >
                <For each={availableStatuses()}>
                  {(s) => (
                    <option
                      value={s}
                      disabled={isStatusDisabled(s)}
                      style={{ background: "var(--ui-bg)", color: isStatusDisabled(s) ? "var(--ui-text-placeholder)" : "var(--ui-text)" }}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}{isStatusDisabled(s) && statusHint(s) ? ` (${statusHint(s)})` : ''}
                    </option>
                  )}
                </For>
              </select>
            </div>
          </Show>
        </div>
      </div>

      {/* Schema-rendered form */}
      <div
        class="rounded-xl p-6"
        style={{
          "background-color": "var(--ui-bg-subtle)",
          border: "1px solid var(--ui-border)",
        }}
      >
        <Renderer node={props.schema as any} />
      </div>
    </div>
  )
}
