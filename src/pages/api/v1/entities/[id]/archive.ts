import type { APIRoute } from 'astro'
import { authenticate } from '../../../../../../server/middleware/auth'
import { archiveEntity, restoreEntity } from '../../../../../../server/modules/lifecycle/service'

// POST /api/v1/entities/:id/archive
export const POST: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    await archiveEntity(params.id!)
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

// DELETE /api/v1/entities/:id/archive — restore
export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    await restoreEntity(params.id!)
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
