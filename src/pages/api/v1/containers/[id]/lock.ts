import type { APIRoute } from 'astro'
import * as containerService from '../../../../../../server/modules/containers/service'
import { authenticate } from '../../../../../../server/middleware/auth'

// POST /api/v1/containers/:id/lock — lock container
export const POST: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const container = await containerService.lockContainer(params.id!)
    return Response.json(container)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
