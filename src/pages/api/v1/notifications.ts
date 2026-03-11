import type { APIRoute } from 'astro'
import { authenticate } from '../../../../server/middleware/auth'
import * as notificationService from '../../../../server/modules/notifications/service'

// GET /api/v1/notifications — user's in-app inbox
export const GET: APIRoute = async ({ request, url }) => {
  try {
    const user = authenticate(request)
    const limit = parseInt(url.searchParams.get('limit') ?? '50')
    const offset = parseInt(url.searchParams.get('offset') ?? '0')
    const result = await notificationService.getInbox(user.id, { limit, offset })
    const unread = await notificationService.getUnreadCount(user.id)
    return Response.json({ ...result, unread })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
