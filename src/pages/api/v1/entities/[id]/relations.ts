import type { APIRoute } from 'astro'
import * as relationService from '../../../../../../server/modules/relations/service'
import { authenticate } from '../../../../../../server/middleware/auth'

// GET /api/v1/entities/:id/relations — get relations for an entity
export const GET: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const url = new URL(request.url)
    const direction = (url.searchParams.get('direction') ?? 'both') as 'source' | 'target' | 'both'
    const relations = await relationService.getEntityRelations(params.id!, direction)
    return Response.json(relations)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
