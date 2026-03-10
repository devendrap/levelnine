import type { APIRoute } from 'astro'
import * as explorationService from '../../../../../../../../server/modules/exploration/service'
import { authenticate } from '../../../../../../../../server/middleware/auth'

// POST /api/v1/containers/:id/exploration/gate/:stepId — submit gate decision
export const POST: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const body = await request.json()
    const { decision, notes } = body

    if (!decision || !['continue', 'go_deeper', 'skip', 'stop'].includes(decision)) {
      return Response.json({ error: 'Valid decision required: continue, go_deeper, skip, stop' }, { status: 400 })
    }

    const result = await explorationService.submitGateDecision(params.stepId!, decision, notes)
    return Response.json(result)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
