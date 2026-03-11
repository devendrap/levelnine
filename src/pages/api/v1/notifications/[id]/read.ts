import type { APIRoute } from 'astro'
import { authenticate } from '../../../../../../server/middleware/auth'
import * as notificationService from '../../../../../../server/modules/notifications/service'

// POST /api/v1/notifications/:id/read — mark as read
export const POST: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    await notificationService.markAsRead(params.id!)
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
