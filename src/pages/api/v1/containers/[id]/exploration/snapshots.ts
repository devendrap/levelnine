import type { APIRoute } from 'astro'
import * as explorationService from '../../../../../../../server/modules/exploration/service'
import { authenticate } from '../../../../../../../server/middleware/auth'

// GET /api/v1/containers/:id/exploration/snapshots — get snapshot history
export const GET: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const snapshots = await explorationService.getSnapshots(params.id!)
    return Response.json(snapshots)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
