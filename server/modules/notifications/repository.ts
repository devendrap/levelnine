import { query } from '../../db/index'

export interface NotificationQueueEntry {
  id: string
  container_id: string
  recipient_user_id: string
  channel: 'email' | 'in_app'
  subject: string | null
  body: string
  payload: Record<string, any>
  status: 'pending' | 'sent' | 'read' | 'failed'
  entity_id: string | null
  sent_at: Date | null
  read_at: Date | null
  created_at: Date
}

export async function enqueue(data: {
  container_id: string
  recipient_user_id: string
  channel: 'email' | 'in_app'
  subject?: string
  body: string
  payload?: Record<string, any>
  entity_id?: string
}): Promise<NotificationQueueEntry> {
  const result = await query<NotificationQueueEntry>(
    `INSERT INTO app_notifications (container_id, recipient_user_id, channel, subject, body, payload, entity_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [data.container_id, data.recipient_user_id, data.channel,
     data.subject ?? null, data.body, JSON.stringify(data.payload ?? {}),
     data.entity_id ?? null],
  )
  return result.rows[0]
}

export async function findPending(limit = 100): Promise<NotificationQueueEntry[]> {
  const result = await query<NotificationQueueEntry>(
    `SELECT * FROM app_notifications WHERE status = 'pending' ORDER BY created_at LIMIT $1`,
    [limit],
  )
  return result.rows
}

export async function markSent(id: string): Promise<void> {
  await query(
    `UPDATE app_notifications SET status = 'sent', sent_at = NOW() WHERE id = $1`,
    [id],
  )
}

export async function markRead(id: string): Promise<void> {
  await query(
    `UPDATE app_notifications SET status = 'read', read_at = NOW() WHERE id = $1`,
    [id],
  )
}

export async function markFailed(id: string): Promise<void> {
  await query(
    `UPDATE app_notifications SET status = 'failed' WHERE id = $1`,
    [id],
  )
}

export async function findByRecipient(
  userId: string,
  opts: { status?: string; limit?: number; offset?: number } = {},
): Promise<{ entries: NotificationQueueEntry[]; total: number }> {
  const limit = opts.limit ?? 50
  const offset = opts.offset ?? 0
  const conditions = ['recipient_user_id = $1', "channel = 'in_app'"]
  const params: any[] = [userId]
  let idx = 2

  if (opts.status) {
    conditions.push(`status = $${idx++}`)
    params.push(opts.status)
  }

  const where = conditions.join(' AND ')

  const [entries, countResult] = await Promise.all([
    query<NotificationQueueEntry>(
      `SELECT * FROM app_notifications WHERE ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      [...params, limit, offset],
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM app_notifications WHERE ${where}`,
      params,
    ),
  ])

  return {
    entries: entries.rows,
    total: parseInt(countResult.rows[0]?.count ?? '0'),
  }
}

export async function countUnread(userId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM app_notifications
     WHERE recipient_user_id = $1 AND channel = 'in_app' AND status IN ('pending', 'sent')`,
    [userId],
  )
  return parseInt(result.rows[0]?.count ?? '0')
}
