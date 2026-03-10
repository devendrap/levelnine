import type { APIRoute } from 'astro'
import * as explorationService from '../../../../../../../server/modules/exploration/service'
import { authenticate } from '../../../../../../../server/middleware/auth'

// POST /api/v1/containers/:id/exploration/start — start new exploration run
export const POST: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const run = await explorationService.startExploration(params.id!)
    return Response.json(run)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
