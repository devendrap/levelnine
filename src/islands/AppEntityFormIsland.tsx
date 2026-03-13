import { createSignal, createMemo, onMount, Show, For } from 'solid-js'
import { useStore } from '@nanostores/solid'
import { $formData, resetFormData, seedFormData } from '../stores/ui'
import { Renderer } from '../renderer/Renderer'
import DeletePopoverIsland, { showDeletePopover } from './DeletePopoverIsland'

type TransitionInfo = { to: string; role?: string; conditions?: string; allowed: boolean; reason?: string }

type UINode = { type: string; props?: Record<string, any>; children?: UINode[] }

type DetailSection = { label: string; fields?: string[]; related_entity_type?: string }

type DetailConfig = {
  layout?: 'tabs' | 'accordion' | 'sections'
  sections?: DetailSection[]
} | null

/** Full-width field types (rendered spanning both grid columns) */
const WIDE_TYPES = new Set(['Textarea', 'RichText', 'TextArea'])

/** Types that represent form fields with a bind prop */
const FORM_FIELD_TYPES = new Set([
  'Input', 'Select', 'Checkbox', 'DatePicker', 'Textarea', 'RichText',
  'TextArea', 'NumberInput', 'Switch', 'Toggle', 'RadioGroup', 'FileUpload',
])

/** Recursively collect form field nodes from a UI spec tree */
function collectFields(node: UINode): UINode[] {
  const fields: UINode[] = []
  if (FORM_FIELD_TYPES.has(node.type) && node.props?.bind) {
    fields.push(node)
  }
  if (node.children) {
    for (const child of node.children) {
      fields.push(...collectFields(child))
    }
  }
  return fields
}

/** Build field sections from detail_config or auto-group */
function buildSections(
  fields: UINode[],
  detailConfig: DetailConfig,
): Array<{ label: string; fields: UINode[] }> {
  if (detailConfig?.sections?.length) {
    const fieldMap = new Map<string, UINode>()
    for (const f of fields) {
      if (f.props?.bind) fieldMap.set(f.props.bind, f)
    }
    const assigned = new Set<string>()
    const sections: Array<{ label: string; fields: UINode[] }> = []
    for (const sec of detailConfig.sections) {
      if (!sec.fields?.length) continue
      const matched = sec.fields
        .filter(name => fieldMap.has(name))
        .map(name => { assigned.add(name); return fieldMap.get(name)! })
      if (matched.length > 0) {
        sections.push({ label: sec.label, fields: matched })
      }
    }
    // Remaining unassigned fields
    const remaining = fields.filter(f => f.props?.bind && !assigned.has(f.props.bind))
    if (remaining.length > 0) {
      sections.push({ label: 'Other Details', fields: remaining })
    }
    return sections
  }

  // Auto-group: ~5 fields per section
  const CHUNK = 5
  const sections: Array<{ label: string; fields: UINode[] }> = []
  if (fields.length <= CHUNK) {
    sections.push({ label: 'Details', fields })
  } else {
    for (let i = 0; i < fields.length; i += CHUNK) {
      const chunk = fields.slice(i, i + CHUNK)
      const idx = Math.floor(i / CHUNK)
      const sectionLabels = ['General Information', 'Additional Details', 'Configuration', 'Classification', 'Notes & Metadata']
      sections.push({ label: sectionLabels[idx] ?? `Section ${idx + 1}`, fields: chunk })
    }
  }
  return sections
}

export default function AppEntityFormIsland(props: {
  containerId: string
  slug: string
  typeName: string
  entityTypeId: string
  schema: Record<string, any>
  detailConfig?: DetailConfig
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

  // Extract fields and build sections
  const allFields = createMemo(() => collectFields(props.schema as UINode))
  const sections = createMemo(() => buildSections(allFields(), props.detailConfig ?? null))
  const hasStructuredFields = createMemo(() => allFields().length > 0)

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
    const set = new Set([current, ...allowed])
    return workflowStatuses().filter(s => set.has(s))
  }

  const isStatusDisabled = (s: string) => {
    if (s === (props.entityStatus ?? status())) return false
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
              class="ui-badge"
              classList={{
                'ui-badge-success': status() === 'approved',
                'ui-badge-warning': status() === 'review',
                'ui-badge-muted': status() !== 'approved' && status() !== 'review',
              }}
            >
              {status()}
            </span>
          </Show>
        </div>
        <Show when={!props.readOnly}>
          <div class="flex items-center gap-3">
            <Show when={error()}>
              <span class="text-xs" style={{ color: "var(--ui-error)" }}>{error()}</span>
            </Show>
            <Show when={saved()}>
              <span class="text-xs" style={{ color: "var(--ui-success)" }}>Saved</span>
            </Show>
            <Show when={isEdit}>
              <button
                class="ui-btn ui-btn-ghost ui-btn-sm"
                style={{ color: 'var(--ui-error)' }}
                onClick={(e: MouseEvent) => showDeletePopover(props.entityId!, e.currentTarget as HTMLElement)}
                aria-label={`Delete ${label}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </Show>
            <a
              href={`/apps/${props.slug}/${props.typeName}`}
              class="ui-btn ui-btn-secondary ui-btn-sm"
            >
              Cancel
            </a>
            <button
              onClick={save}
              disabled={saving()}
              class="ui-btn ui-btn-primary"
            >
              {saving() ? 'Saving...' : isEdit ? 'Save Changes' : `Create ${label}`}
            </button>
          </div>
        </Show>
      </div>

      {/* Section 1: Identity (Name + Status) */}
      <div class="ui-section mb-4">
        <div class="ui-section-header">
          <span class="ui-section-number">1</span>
          Identity
        </div>
        <div class="ui-section-body">
          <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '16px' }}>
            <div>
              <label class="ui-label">Name</label>
              <input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder={`Enter ${label.toLowerCase()} name...`}
                disabled={props.readOnly}
                class="ui-input"
                classList={{ 'ui-input-readonly': !!props.readOnly }}
              />
            </div>
            <Show when={isEdit}>
              <div>
                <label class="ui-label">Status</label>
                <select
                  value={status()}
                  onChange={(e) => setStatus(e.currentTarget.value)}
                  disabled={props.readOnly}
                  class="ui-select"
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
      </div>

      {/* Schema-rendered form fields in sections */}
      <Show
        when={hasStructuredFields()}
        fallback={
          /* Fallback: render schema as-is when no bindable fields found */
          <div class="ui-section">
            <div class="ui-section-header">
              <span class="ui-section-number">2</span>
              Details
            </div>
            <div class="ui-section-body">
              <Renderer node={props.schema as any} readOnly={props.readOnly} />
            </div>
          </div>
        }
      >
        <For each={sections()}>
          {(section, sectionIdx) => (
            <div class="ui-section mb-4">
              <div class="ui-section-header">
                <span class="ui-section-number">{sectionIdx() + 2}</span>
                {section.label}
              </div>
              <div class="ui-section-body">
                <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '16px' }}>
                  <For each={section.fields}>
                    {(field) => (
                      <div
                        style={{
                          'grid-column': WIDE_TYPES.has(field.type) ? 'span 2' : undefined,
                        }}
                      >
                        <Renderer node={field as any} readOnly={props.readOnly} />
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>
          )}
        </For>
      </Show>

      {/* Bottom action bar (visible on long forms) */}
      <Show when={!props.readOnly && allFields().length > 6}>
        <div
          class="flex items-center justify-end gap-3 mt-6 pt-4"
          style={{ 'border-top': '1px solid var(--ui-border)' }}
        >
          <a
            href={`/apps/${props.slug}/${props.typeName}`}
            class="ui-btn ui-btn-secondary ui-btn-sm"
          >
            Cancel
          </a>
          <button
            onClick={save}
            disabled={saving()}
            class="ui-btn ui-btn-primary"
          >
            {saving() ? 'Saving...' : isEdit ? 'Save Changes' : `Create ${label}`}
          </button>
        </div>
      </Show>

      {/* Delete confirmation popover */}
      <Show when={isEdit}>
        <DeletePopoverIsland
          entityName={label}
          onConfirm={async (id: string) => {
            const res = await fetch(`/api/v1/entities/${id}`, { method: 'DELETE' })
            if (!res.ok) {
              const err = await res.json().catch(() => ({ error: 'Delete failed' }))
              throw new Error(err.error ?? 'Delete failed')
            }
            window.location.href = `/apps/${props.slug}/${props.typeName}`
          }}
        />
      </Show>
    </div>
  )
}
