import type { APIRoute } from 'astro'
import * as containerService from '../../../../../../server/modules/containers/service'
import { authenticate } from '../../../../../../server/middleware/auth'

// POST /api/v1/containers/:id/unlock — unlock a reviewed entity type for editing
export const POST: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const { name } = await request.json()
    if (!name) {
      return Response.json({ error: 'name is required' }, { status: 400 })
    }
    const container = await containerService.unlockEntityType(params.id!, name)
    return Response.json(container)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
