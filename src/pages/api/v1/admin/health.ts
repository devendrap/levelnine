import type { APIRoute } from 'astro'
import { authenticate, requireRole } from '../../../../../server/middleware/auth'
import { query } from '../../../../../server/db/index'

/** Count entity type names identifiable from a chat message (server-side version of parser logic) */
function countChatEntityTypes(content: string): string[] {
  const names: string[] = []

  // 1. Try json:entity_types block
  const summaryMatch = content.match(/```json:entity_types\n([\s\S]*?)```/)
  if (summaryMatch) {
    try {
      const parsed = JSON.parse(summaryMatch[1].trim())
      if (Array.isArray(parsed)) {
        for (const e of parsed) {
          if (e.name) names.push(e.name)
        }
        return names
      }
    } catch { /* fall through */ }
  }

  // 2. Try json blocks containing arrays with name+description
  const blockRegex = /```json\n([\s\S]*?)```/g
  let match
  while ((match = blockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (Array.isArray(parsed) && parsed[0]?.name) {
        for (const e of parsed) if (e.name) names.push(e.name)
      }
    } catch { /* skip */ }
  }
  if (names.length > 0) return names

  // 3. Fallback: bold snake_case names (how the chat UI shows them)
  const boldNames = content.match(/\*\*(\w+_\w+)\*\*/g)
  if (boldNames) {
    const seen = new Set<string>()
    for (const bn of boldNames) {
      const name = bn.replace(/\*\*/g, '')
      if (!seen.has(name)) { seen.add(name); names.push(name) }
    }
  }

  return names
}

/**
 * GET /api/v1/admin/health
 * Admin-only endpoint returning database state, table counts, and orphan detection.
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    const auth = authenticate(request)
    requireRole(auth, 'admin')

    const [counts, containers, orphans, recentActivity, migrations, chatMessages] = await Promise.all([
      // Table row counts
      query<{ table_name: string; row_count: number }>(`
        SELECT t.table_name, s.n_live_tup::int AS row_count
        FROM information_schema.tables t
        JOIN pg_stat_user_tables s ON s.relname = t.table_name
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name
      `),

      // Container summary with chat + manifest + materialized counts
      query<{
        id: string; name: string; slug: string; status: string
        message_count: number; manifest_type_count: number
        materialized_type_count: number; entity_count: number; app_user_count: number
      }>(`
        SELECT c.id, c.name, c.slug, c.status,
          (SELECT count(*)::int FROM chat_messages WHERE container_id = c.id) AS message_count,
          COALESCE(jsonb_array_length(c.manifest->'entity_types'), 0)::int AS manifest_type_count,
          (SELECT count(*)::int FROM entity_types WHERE container_id = c.id) AS materialized_type_count,
          (SELECT count(*)::int FROM entities WHERE container_id = c.id) AS entity_count,
          (SELECT count(*)::int FROM app_users WHERE container_id = c.id) AS app_user_count
        FROM containers c
        ORDER BY c.created_at DESC
      `),

      // Orphan detection: entity_types/entities without valid container
      query<{ issue: string; count: number }>(`
        SELECT 'entity_types without container' AS issue, count(*)::int
        FROM entity_types WHERE container_id IS NOT NULL AND container_id NOT IN (SELECT id FROM containers)
        UNION ALL
        SELECT 'entities without container', count(*)::int
        FROM entities WHERE container_id IS NOT NULL AND container_id NOT IN (SELECT id FROM containers)
        UNION ALL
        SELECT 'entities without entity_type', count(*)::int
        FROM entities WHERE entity_type_id NOT IN (SELECT id FROM entity_types)
        UNION ALL
        SELECT 'app_users without container', count(*)::int
        FROM app_users WHERE container_id NOT IN (SELECT id FROM containers)
        UNION ALL
        SELECT 'entity_relations with missing source', count(*)::int
        FROM entity_relations WHERE source_entity_id NOT IN (SELECT id FROM entities)
        UNION ALL
        SELECT 'entity_relations with missing target', count(*)::int
        FROM entity_relations WHERE target_entity_id NOT IN (SELECT id FROM entities)
      `),

      // Recent activity (last 10 entities modified)
      query<{ id: string; name: string; type_name: string; status: string; updated_at: string }>(`
        SELECT e.id, e.name, et.name AS type_name, e.status, e.updated_at::text
        FROM entities e
        JOIN entity_types et ON et.id = e.entity_type_id
        ORDER BY e.updated_at DESC
        LIMIT 10
      `),

      // Applied migrations
      query<{ name: string; applied_at: string }>(`
        SELECT name, applied_at::text FROM sys_migrations ORDER BY id
      `),

      // Chat messages (assistant only) for entity type extraction
      query<{ container_id: string; content: string }>(`
        SELECT container_id, content FROM chat_messages
        WHERE role = 'assistant'
        ORDER BY created_at
      `),
    ])

    const orphanIssues = orphans.rows.filter(r => r.count > 0)

    // Parse entity types from chat messages per container
    const chatTypesByContainer = new Map<string, string[]>()
    for (const msg of chatMessages.rows) {
      const types = countChatEntityTypes(msg.content)
      if (types.length > 0) {
        const existing = chatTypesByContainer.get(msg.container_id) ?? []
        // Merge unique names
        for (const t of types) {
          if (!existing.includes(t)) existing.push(t)
        }
        chatTypesByContainer.set(msg.container_id, existing)
      }
    }

    // Enrich container rows with chat-identified type counts
    const enrichedContainers = containers.rows.map(c => {
      const chatTypes = chatTypesByContainer.get(c.id) ?? []
      return {
        ...c,
        chat_identified_types: chatTypes.length,
        chat_type_names: chatTypes,
      }
    })

    return Response.json({
      status: orphanIssues.length === 0 ? 'healthy' : 'has_orphans',
      tables: Object.fromEntries(counts.rows.map(r => [r.table_name, r.row_count])),
      containers: enrichedContainers,
      orphans: orphanIssues,
      recent_activity: recentActivity.rows,
      migrations: migrations.rows.map(r => r.name),
      checked_at: new Date().toISOString(),
    })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 401 })
  }
}
