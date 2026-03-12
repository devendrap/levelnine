import { query } from '../../db/index'

export interface AuditLogEntry {
  id: string
  entity_id: string
  entity_type_id: string | null
  container_id: string | null
  action: 'create' | 'update' | 'delete' | 'status_change'
  field_changes: Record<string, any>
  old_values: Record<string, any>
  new_values: Record<string, any>
  user_id: string | null
  user_name?: string
  created_at: Date
}

export async function findByEntityId(
  entityId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const limit = opts.limit ?? 50
  const offset = opts.offset ?? 0

  const [entries, countResult] = await Promise.all([
    query<AuditLogEntry & { user_name: string }>(
      `SELECT a.*, u.name as user_name
       FROM sys_audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.entity_id = $1
       ORDER BY a.created_at DESC
       LIMIT $2 OFFSET $3`,
      [entityId, limit, offset],
    ),
    query<{ count: string }>(
      'SELECT COUNT(*) as count FROM sys_audit_log WHERE entity_id = $1',
      [entityId],
    ),
  ])

  return {
    entries: entries.rows,
    total: parseInt(countResult.rows[0]?.count ?? '0'),
  }
}

export async function findByContainerId(
  containerId: string,
  opts: { limit?: number; offset?: number; action?: string } = {},
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const limit = opts.limit ?? 50
  const offset = opts.offset ?? 0
  const conditions = ['a.container_id = $1']
  const params: any[] = [containerId]
  let idx = 2

  if (opts.action) {
    conditions.push(`a.action = $${idx++}`)
    params.push(opts.action)
  }

  const where = conditions.join(' AND ')

  const [entries, countResult] = await Promise.all([
    query<AuditLogEntry & { user_name: string }>(
      `SELECT a.*, u.name as user_name
       FROM sys_audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE ${where}
       ORDER BY a.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      [...params, limit, offset],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM sys_audit_log a WHERE ${where}`,
      params,
    ),
  ])

  return {
    entries: entries.rows,
    total: parseInt(countResult.rows[0]?.count ?? '0'),
  }
}
