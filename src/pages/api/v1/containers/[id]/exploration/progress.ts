import type { APIRoute } from 'astro'
import * as explorationService from '../../../../../../../server/modules/exploration/service'
import { authenticate } from '../../../../../../../server/middleware/auth'

// GET /api/v1/containers/:id/exploration/progress — get current exploration state
export const GET: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const progress = await explorationService.getProgress(params.id!)
    return Response.json(progress)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
