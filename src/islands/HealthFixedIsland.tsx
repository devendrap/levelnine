import { createSignal, createResource, Show, For } from 'solid-js'
import { Renderer } from '../renderer/Renderer'
import type { UIComponent } from '../renderer/types'

interface AppContainer {
  id: string
  name: string
  slug: string
  description: string | null
  status: string
  manifest: any
}

async function fetchLaunchedApps(): Promise<AppContainer[]> {
  const res = await fetch('/api/v1/containers')
  if (!res.ok) return []
  const all = await res.json()
  return all.filter((c: any) => c.status === 'launched' && c.slug)
}

function buildSpec(data: any): UIComponent {
  const tables = data.tables ?? {}
  const containers = data.containers ?? []
  const orphans = data.orphans ?? []
  const activity = data.recent_activity ?? []
  const migrations = data.migrations ?? []

  // Aggregate pipeline stats across containers
  const totalMessages = containers.reduce((s: number, c: any) => s + (c.message_count ?? 0), 0)
  const totalChatIdentified = containers.reduce((s: number, c: any) => s + (c.chat_identified_types ?? 0), 0)
  const totalManifestTypes = containers.reduce((s: number, c: any) => s + (c.manifest_type_count ?? 0), 0)
  const totalMaterializedTypes = containers.reduce((s: number, c: any) => s + (c.materialized_type_count ?? 0), 0)

  // Summary stat cards — show the full pipeline
  const statCards = [
    { label: 'Containers', value: String(tables.containers ?? 0) },
    { label: 'Chat Messages', value: String(totalMessages) },
    { label: 'Chat → Identified', value: String(totalChatIdentified) },
    { label: 'Manifest (saved)', value: String(totalManifestTypes) },
    { label: 'Materialized (DB)', value: String(totalMaterializedTypes) },
    { label: 'Live Entities', value: String(tables.entities ?? 0) },
  ]

  // Table counts grouped by category
  const coreTableNames = new Set(['containers', 'chat_messages', 'entity_types', 'entities', 'entity_relations', 'users', 'app_users'])
  const explorationTableNames = new Set(['exp_dimensions', 'exp_runs', 'exp_steps', 'exp_snapshots'])
  const artifactTableNames = new Set(['cfg_relations', 'cfg_roles', 'cfg_workflows', 'cfg_compliance', 'cfg_documents', 'cfg_integrations', 'cfg_reports', 'cfg_edge_cases', 'cfg_notifications', 'cfg_ui_configs', 'cfg_pages'])
  const systemTableNames = new Set(['sys_migrations', 'sys_audit_log', 'sys_validation_rules', 'sys_lifecycle_policies', 'sys_data_classifications'])

  const coreTables = Object.entries(tables).filter(([name]) => coreTableNames.has(name)).map(([name, count]) => [name, String(count)])
  const explorationTables = Object.entries(tables).filter(([name]) => explorationTableNames.has(name)).map(([name, count]) => [name, String(count)])
  const artifactTables = Object.entries(tables).filter(([name]) => artifactTableNames.has(name)).map(([name, count]) => [name, String(count)])
  const systemTables = Object.entries(tables).filter(([name]) => systemTableNames.has(name)).map(([name, count]) => [name, String(count)])
  const otherTables = Object.entries(tables).filter(([name]) => !coreTableNames.has(name) && !explorationTableNames.has(name) && !artifactTableNames.has(name) && !systemTableNames.has(name)).map(([name, count]) => [name, String(count)])

  // Container detail rows — full pipeline
  const containerRows = containers.map((c: any) => [
    c.name,
    c.slug ?? '-',
    c.status ?? '-',
    String(c.message_count ?? 0),
    String(c.chat_identified_types ?? 0),
    String(c.manifest_type_count ?? 0),
    String(c.materialized_type_count ?? 0),
    String(c.entity_count),
    String(c.app_user_count),
  ])

  // Recent activity rows
  const activityRows = activity.map((a: any) => [
    a.name,
    a.type_name,
    a.status ?? '-',
    a.updated_at?.slice(0, 19) ?? '-',
  ])

  // Build recommendations based on pipeline state
  const recommendations: UIComponent[] = []
  for (const c of containers) {
    const chatId = c.chat_identified_types ?? 0
    const manifest = c.manifest_type_count ?? 0
    const materialized = c.materialized_type_count ?? 0
    const entities = c.entity_count ?? 0
    const users = c.app_user_count ?? 0
    const msgs = c.message_count ?? 0
    const name = c.name

    // Stage 0: No chat yet
    if (msgs === 0) {
      recommendations.push({ type: 'Alert', props: { title: `[HIGH] ${name}: No conversations yet. Start chatting to describe your domain — the LLM will identify entity types from the discussion.`, variant: 'warning' } })
      continue
    }

    // Stage 1: Chat happened but few/no types identified
    if (chatId === 0) {
      recommendations.push({ type: 'Alert', props: { title: `[HIGH] ${name}: ${msgs} messages exchanged but no entity types identified. Ask the LLM to define the entity types for your domain.`, variant: 'warning' } })
      continue
    }

    // Stage 2: Types identified but not saved
    if (manifest === 0) {
      const sizeHint = chatId >= 20
        ? `Large model (${chatId} types). Review for redundant/overlapping types before saving.`
        : chatId >= 10
        ? `${chatId} types identified — solid foundation. Save to manifest when ready.`
        : `Small model (${chatId} types). Consider chatting more to flesh out the domain, or save what you have.`
      recommendations.push({ type: 'Alert', props: { title: `[HIGH] ${name}: ${sizeHint} Open the container and click "Save All" to persist to manifest.`, variant: 'warning' } })
    }

    // Stage 3: Saved but not materialized
    else if (materialized === 0) {
      const msg = manifest >= 15
        ? `${manifest} types in manifest — comprehensive model. Run "Generate Schemas" to create type packages with UI specs, data schemas, and field metadata.`
        : `${manifest} types in manifest. Click "Generate Schemas" to materialize them into the database.`
      recommendations.push({ type: 'Alert', props: { title: `[HIGH] ${name}: ${msg}`, variant: 'warning' } })
    }

    // Stage 4: Materialized but no data
    else if (entities === 0) {
      recommendations.push({ type: 'Alert', props: { title: `[MEDIUM] ${name}: ${materialized} entity types materialized and ready. Launch the app and start entering data.`, variant: 'info' } })
    }

    // Stage 5: Running — check health
    else {
      const ratio = entities / materialized
      if (ratio < 1) {
        recommendations.push({ type: 'Alert', props: { title: `[LOW] ${name}: ${entities} entities across ${materialized} types (avg ${ratio.toFixed(1)} per type). Some types may need sample data.`, variant: 'default' } })
      }
    }

    // Cross-cutting: draft status
    if (c.status === 'draft' && chatId >= 10) {
      recommendations.push({ type: 'Alert', props: { title: `[MEDIUM] ${name}: Container is still in draft with ${chatId} types identified. Review the entity model and lock when complete.`, variant: 'info' } })
    }

    // Cross-cutting: no users
    if (materialized > 0 && users === 0) {
      recommendations.push({ type: 'Alert', props: { title: `[LOW] ${name}: No app users invited yet. Invite users to start using the deployed app.`, variant: 'default' } })
    }

    // Cross-cutting: manifest vs chat gap (types lost in transit)
    if (manifest > 0 && chatId > manifest) {
      const gap = chatId - manifest
      recommendations.push({ type: 'Alert', props: { title: `[MEDIUM] ${name}: ${gap} types from chat not in manifest (${chatId} identified, ${manifest} saved). Re-run "Save All" to capture them.`, variant: 'info' } })
    }
  }

  if (containers.length === 0) {
    recommendations.push({ type: 'Alert', props: { title: '[HIGH] No containers exist. Create a container via the Container Manager to start building an industry template.', variant: 'warning' } })
  }

  if (orphans.length > 0) {
    recommendations.push({ type: 'Alert', props: { title: `[HIGH] ${orphans.length} orphan issue(s) detected. Investigate and clean up dangling references.`, variant: 'warning' } })
  }

  const spec: UIComponent = {
    type: 'Stack',
    props: { gap: '6' },
    children: [
      { type: 'Row', props: { gap: '4', align: 'center' }, children: [
        { type: 'Heading', props: { level: 1, content: 'System Health' } },
        { type: 'Badge', props: { label: data.status === 'healthy' ? 'Healthy' : 'Has Orphans', variant: data.status === 'healthy' ? 'success' : 'warning' } },
      ]},
      { type: 'Text', props: { content: `Last checked: ${data.checked_at?.slice(0, 19) ?? 'unknown'}`, variant: 'caption' } },

      // Stat cards row
      {
        type: 'Row', props: { gap: '4' }, children: statCards.map(s => ({
          type: 'Card', props: { title: s.label }, children: [
            { type: 'Heading', props: { level: 2, content: s.value } },
          ],
        })),
      },

      // Recommendations
      ...(recommendations.length > 0 ? [{
        type: 'Card' as const, props: { title: 'Recommended Next Steps' }, children: [
          { type: 'Stack' as const, props: { gap: '2' }, children: recommendations },
        ],
      }] : []),

      // Tabs for detail sections
      {
        type: 'Tabs',
        props: {
          tabs: [
            {
              label: 'Containers',
              value: 'containers',
              children: containerRows.length > 0 ? [
                { type: 'Table', props: { columns: ['Name', 'Slug', 'Status', 'Messages', 'Chat Identified', 'Manifest', 'Materialized', 'Entities', 'Users'], rows: containerRows } },
              ] : [
                { type: 'Text', props: { content: 'No containers found.', variant: 'muted' } },
              ],
            },
            {
              label: 'All Tables',
              value: 'tables',
              children: [
                { type: 'Heading', props: { level: 4, content: 'Core' } },
                { type: 'Table', props: { columns: ['Table', 'Rows'], rows: coreTables } },
                { type: 'Spacer', props: { size: 'sm' } },
                { type: 'Heading', props: { level: 4, content: 'Artifacts' } },
                { type: 'Table', props: { columns: ['Table', 'Rows'], rows: artifactTables } },
                { type: 'Spacer', props: { size: 'sm' } },
                { type: 'Heading', props: { level: 4, content: 'Exploration' } },
                { type: 'Table', props: { columns: ['Table', 'Rows'], rows: explorationTables } },
                { type: 'Spacer', props: { size: 'sm' } },
                { type: 'Heading', props: { level: 4, content: 'System' } },
                { type: 'Table', props: { columns: ['Table', 'Rows'], rows: systemTables } },
                ...(otherTables.length > 0 ? [
                  { type: 'Spacer' as const, props: { size: 'sm' } },
                  { type: 'Heading' as const, props: { level: 4, content: 'Other' } },
                  { type: 'Table' as const, props: { columns: ['Table', 'Rows'], rows: otherTables } },
                ] : []),
              ],
            },
            {
              label: 'Recent Activity',
              value: 'activity',
              children: activityRows.length > 0 ? [
                { type: 'Table', props: { columns: ['Name', 'Type', 'Status', 'Updated'], rows: activityRows } },
              ] : [
                { type: 'Text', props: { content: 'No recent activity.', variant: 'muted' } },
              ],
            },
            {
              label: `Orphans (${orphans.length})`,
              value: 'orphans',
              children: orphans.length > 0
                ? [{ type: 'Table', props: { columns: ['Issue', 'Count'], rows: orphans.map((o: any) => [o.issue, String(o.count)]) } }]
                : [{ type: 'Alert', props: { title: 'No orphans detected', variant: 'default' } }],
            },
            {
              label: 'Migrations',
              value: 'migrations',
              children: [
                { type: 'List', props: { items: migrations, variant: 'ordered' } },
              ],
            },
          ],
        },
      },
    ],
  }

  return spec
}

export default function HealthFixedIsland() {
  const [refetchKey, setRefetchKey] = createSignal(0)
  const [user, setUser] = createSignal<any>(null)
  const [apps] = createResource(fetchLaunchedApps)

  // Fetch current user on mount (not at module level)
  onMount(() => {
    fetch('/api/v1/auth/me').then(r => r.ok ? r.json() : null).then(d => d && setUser(d.user)).catch(() => {})
  })

  const [data] = createResource(refetchKey, async () => {
    const res = await fetch('/api/v1/admin/health')
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  })

  const logout = async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <div class="dark min-h-screen" style={{ "background-color": "var(--ui-bg)", "font-family": "var(--ui-font)" }}>
      {/* Header bar */}
      <header class="flex items-center justify-between px-6 py-3 border-b"
        style={{ "background-color": "var(--ui-card-bg)", "border-color": "var(--ui-border)" }}
      >
        <div class="flex items-center gap-4">
          <a href="/dashboard"><img src="/icon.png" alt="LevelNine" style={{ height: "28px" }} /></a>
          <a href="/dashboard" class="text-sm px-3 py-1 rounded-lg border hover:opacity-80"
            style={{ "border-color": "var(--ui-border)", color: "var(--ui-text-muted)" }}>Dashboard</a>
          <a href="/containers" class="text-sm px-3 py-1 rounded-lg border hover:opacity-80"
            style={{ "border-color": "var(--ui-border)", color: "var(--ui-text-muted)" }}>Containers</a>
        </div>
        <div class="flex items-center gap-4">
          <a href="/health-dynamic" class="text-sm px-3 py-1 rounded-lg border hover:opacity-80"
            style={{ "border-color": "var(--ui-border)", color: "var(--ui-text-muted)" }}>Dynamic</a>
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
        {/* Launched Apps */}
        <Show when={(apps() ?? []).length > 0}>
          <div class="mb-8">
            <h2 class="text-sm font-semibold mb-3" style={{ color: "var(--ui-text)" }}>Launched Apps</h2>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
              <For each={apps() ?? []}>
                {(app) => {
                  const etCount = app.manifest?.entity_types?.length ?? 0
                  return (
                    <a
                      href={`/apps/${app.slug}`}
                      class="rounded-xl p-5 border transition-all hover:opacity-90"
                      style={{ "background-color": "var(--ui-card-bg)", "border-color": "var(--ui-border)" }}
                    >
                      <div class="flex items-center gap-2 mb-2">
                        <div
                          class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                          style={{ "background-color": "rgba(212,164,74,0.12)", color: "var(--ui-primary)" }}
                        >
                          {app.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="min-w-0">
                          <div class="text-sm font-semibold truncate" style={{ color: "var(--ui-text)" }}>{app.name}</div>
                          <div class="text-[11px]" style={{ color: "var(--ui-text-muted)" }}>{etCount} entity types</div>
                        </div>
                      </div>
                      {app.description && (
                        <p class="text-xs truncate" style={{ color: "var(--ui-text-placeholder)" }}>{app.description}</p>
                      )}
                    </a>
                  )
                }}
              </For>
            </div>
          </div>
        </Show>

        <Show when={data.loading}>
          <div class="flex items-center gap-3 py-10" style={{ color: "var(--ui-text-muted)" }}>
            <div class="w-4 h-4 border-2 rounded-full animate-spin" style={{ "border-color": "var(--ui-primary)", "border-top-color": "transparent" }} />
            <span class="text-sm">Loading health data...</span>
          </div>
        </Show>
        <Show when={data.error}>
          <div class="rounded-lg border px-4 py-3 text-sm" style={{ color: "var(--ui-error)", "background-color": "var(--ui-error-bg)", "border-color": "var(--ui-error-border)" }}>
            Error: {String(data.error)}
          </div>
        </Show>
        <Show when={data() && !data.loading}>
          <div class="flex justify-end mb-4">
            <button
              onClick={() => setRefetchKey(k => k + 1)}
              class="px-4 py-2 text-sm font-semibold rounded-lg cursor-pointer transition-opacity hover:opacity-80"
              style={{ "background-color": "var(--ui-primary)", color: "var(--ui-bg)" }}
            >
              Refresh
            </button>
          </div>
          <Renderer node={buildSpec(data())} />
        </Show>
      </div>
    </div>
  )
}
