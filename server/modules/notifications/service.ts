import * as repo from './repository'
import { query } from '../../db/index'

/**
 * Send a notification to a user. Enqueues for both in-app and email
 * based on the specified channel.
 */
export async function notify(data: {
  container_id: string
  recipient_user_id: string
  channel: 'email' | 'in_app' | 'both'
  subject?: string
  body: string
  payload?: Record<string, any>
  entity_id?: string
}): Promise<void> {
  const channels: ('email' | 'in_app')[] =
    data.channel === 'both' ? ['email', 'in_app'] : [data.channel]

  for (const ch of channels) {
    await repo.enqueue({ ...data, channel: ch })
  }
}

/**
 * Send notification to all users with a given role in a container.
 */
export async function notifyRole(data: {
  container_id: string
  role: string
  channel: 'email' | 'in_app' | 'both'
  subject?: string
  body: string
  payload?: Record<string, any>
  entity_id?: string
}): Promise<void> {
  // Find users with this role in the container's app_users
  const users = await query<{ id: string }>(
    `SELECT id FROM app_users WHERE container_id = $1 AND role = $2 AND is_active = true`,
    [data.container_id, data.role],
  )

  for (const user of users.rows) {
    await notify({ ...data, recipient_user_id: user.id })
  }
}

/**
 * Process pending email notifications.
 * Called by background worker. In-app notifications are delivered via API polling.
 */
export async function processPendingEmails(): Promise<number> {
  const pending = await repo.findPending(50)
  const emails = pending.filter(n => n.channel === 'email')
  let sent = 0

  for (const notification of emails) {
    try {
      // TODO: plug in email transport (nodemailer / SMTP)
      // For now, just mark as sent
      await repo.markSent(notification.id)
      sent++
    } catch {
      await repo.markFailed(notification.id)
    }
  }

  // Auto-mark in-app notifications as "sent" (they're delivered on read)
  const inApp = pending.filter(n => n.channel === 'in_app')
  for (const notification of inApp) {
    await repo.markSent(notification.id)
  }

  return sent
}

/**
 * Get notifications for a user (in-app inbox).
 */
export async function getInbox(
  userId: string,
  opts: { limit?: number; offset?: number } = {},
) {
  return repo.findByRecipient(userId, { ...opts })
}

/**
 * Mark a notification as read.
 */
export async function markAsRead(notificationId: string): Promise<void> {
  await repo.markRead(notificationId)
}

/**
 * Get unread count for notification bell.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return repo.countUnread(userId)
}
