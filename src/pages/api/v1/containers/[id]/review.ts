import type { APIRoute } from 'astro'
import * as containerService from '../../../../../../server/modules/containers/service'
import { authenticate } from '../../../../../../server/middleware/auth'

// POST /api/v1/containers/:id/review — mark entity types as reviewed
export const POST: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const { names } = await request.json()
    if (!Array.isArray(names) || names.length === 0) {
      return Response.json({ error: 'names array is required' }, { status: 400 })
    }
    const container = await containerService.reviewEntityTypes(params.id!, names)
    return Response.json(container)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
