import { createResource, createSignal, Show, For } from 'solid-js'

interface EntityRow {
  id: string
  name: string
  status: string
  entity_type_id: string
  period: string | null
  updated_at: string
}

interface EntityType {
  id: string
  name: string
  description: string | null
}

async function fetchEntities(): Promise<{ data: EntityRow[]; total: number }> {
  const res = await fetch('/api/v1/entities?pageSize=50')
  if (!res.ok) return { data: [], total: 0 }
  return res.json()
}

async function fetchEntityTypes(): Promise<EntityType[]> {
  const res = await fetch('/api/v1/entity-types')
  if (!res.ok) return []
  return res.json()
}

const statusColors: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'var(--ui-bg-muted)', text: 'var(--ui-text-muted)' },
  active: { bg: 'var(--ui-primary-light)', text: 'var(--ui-primary)' },
  review: { bg: 'var(--ui-warning-bg)', text: 'var(--ui-warning)' },
  approved: { bg: 'var(--ui-success-bg)', text: 'var(--ui-success)' },
  archived: { bg: 'var(--ui-bg-muted)', text: 'var(--ui-text-placeholder)' },
}

export default function DashboardIsland() {
  const [entities] = createResource(fetchEntities)
  const [types] = createResource(fetchEntityTypes)
  const [user, setUser] = createSignal<any>(null)

  // Try fetching current user
  fetch('/api/v1/auth/me').then(r => r.ok ? r.json() : null).then(d => d && setUser(d.user))

  const typeNameMap = () => {
    const m = new Map<string, string>()
    for (const t of types() ?? []) m.set(t.id, t.name)
    return m
  }

  const logout = async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST' })
    if ('navigate' in window) {
      (window as any).navigate('/login')
    } else {
      window.location.href = '/login'
    }
  }

  return (
    <div
      class="dark min-h-screen"
      style={{ "background-color": "var(--ui-bg)", "font-family": "var(--ui-font)" }}
    >
      {/* Top bar */}
      <header
        class="flex items-center justify-between px-6 py-3 border-b"
        style={{ "background-color": "var(--ui-card-bg)", "border-color": "var(--ui-border)" }}
      >
        <div class="flex items-center gap-4">
          <h1 class="text-lg font-semibold" style={{ color: "var(--ui-text)" }}>ai-ui</h1>
          <a
            href="/containers"
            class="text-sm px-3 py-1 rounded-lg border hover:opacity-80"
            style={{ "border-color": "var(--ui-border)", color: "var(--ui-primary)" }}
          >
            Containers
          </a>
        </div>
        <div class="flex items-center gap-4">
          <Show when={user()}>
            <span class="text-sm" style={{ color: "var(--ui-text-muted)" }}>{user().name}</span>
            <span
              class="px-2 py-0.5 rounded text-xs font-medium uppercase"
              style={{ "background-color": "var(--ui-primary-light)", color: "var(--ui-primary)" }}
            >
              {user().role}
            </span>
          </Show>
          <button
            onClick={logout}
            class="text-sm cursor-pointer hover:underline"
            style={{ color: "var(--ui-text-muted)" }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div class="max-w-6xl mx-auto px-6 py-8">
        {/* Stats row */}
        <div class="grid grid-cols-3 gap-4 mb-8">
          <div class="p-4 rounded-xl border" style={{ "background-color": "var(--ui-card-bg)", "border-color": "var(--ui-border)" }}>
            <p class="text-sm mb-1" style={{ color: "var(--ui-text-muted)" }}>Entities</p>
            <p class="text-2xl font-semibold" style={{ color: "var(--ui-text)" }}>{entities()?.total ?? '—'}</p>
          </div>
          <div class="p-4 rounded-xl border" style={{ "background-color": "var(--ui-card-bg)", "border-color": "var(--ui-border)" }}>
            <p class="text-sm mb-1" style={{ color: "var(--ui-text-muted)" }}>Entity Types</p>
            <p class="text-2xl font-semibold" style={{ color: "var(--ui-text)" }}>{types()?.length ?? '—'}</p>
          </div>
          <div class="p-4 rounded-xl border" style={{ "background-color": "var(--ui-card-bg)", "border-color": "var(--ui-border)" }}>
            <p class="text-sm mb-1" style={{ color: "var(--ui-text-muted)" }}>Schema-Driven</p>
            <p class="text-2xl font-semibold" style={{ color: "var(--ui-primary)" }}>
              {(types() ?? []).filter(t => t.description).length}
            </p>
          </div>
        </div>

        {/* Entity list */}
        <div class="rounded-xl border overflow-hidden" style={{ "border-color": "var(--ui-border)" }}>
          <table class="w-full">
            <thead>
              <tr style={{ "background-color": "var(--ui-bg-subtle)" }}>
                <th class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ui-text-muted)" }}>Name</th>
                <th class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ui-text-muted)" }}>Type</th>
                <th class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ui-text-muted)" }}>Status</th>
                <th class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ui-text-muted)" }}>Period</th>
                <th class="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ui-text-muted)" }}>Updated</th>
              </tr>
            </thead>
            <tbody>
              <Show when={entities()?.data?.length === 0}>
                <tr>
                  <td colspan="5" class="px-4 py-8 text-center text-sm" style={{ color: "var(--ui-text-muted)" }}>
                    No entities yet. Create one via the API.
                  </td>
                </tr>
              </Show>
              <For each={entities()?.data ?? []}>
                {(entity) => {
                  const sc = () => statusColors[entity.status] ?? statusColors.draft
                  return (
                    <tr class="border-t hover:opacity-90 transition-opacity" style={{ "border-color": "var(--ui-border)" }}>
                      <td class="px-4 py-3">
                        <a
                          href={`/entities/${entity.id}`}
                          class="text-sm font-medium hover:underline"
                          style={{ color: "var(--ui-primary)" }}
                        >
                          {entity.name}
                        </a>
                      </td>
                      <td class="px-4 py-3 text-sm" style={{ color: "var(--ui-text-secondary)" }}>
                        {typeNameMap().get(entity.entity_type_id) ?? '—'}
                      </td>
                      <td class="px-4 py-3">
                        <span
                          class="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ "background-color": sc().bg, color: sc().text }}
                        >
                          {entity.status}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-sm" style={{ color: "var(--ui-text-muted)" }}>
                        {entity.period ?? '—'}
                      </td>
                      <td class="px-4 py-3 text-sm" style={{ color: "var(--ui-text-muted)" }}>
                        {new Date(entity.updated_at).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                }}
              </For>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
