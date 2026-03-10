import type { APIRoute } from 'astro'
import * as service from '../../../../../server/modules/entities/service'

// GET /api/v1/entities?type=X&parent=Y&status=Z&period=P&page=1&pageSize=25
export const GET: APIRoute = async ({ url }) => {
  try {
    const result = await service.listEntities({
      type: url.searchParams.get('type') ?? undefined,
      parent: url.searchParams.get('parent') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      period: url.searchParams.get('period') ?? undefined,
      page: Number(url.searchParams.get('page') ?? 1),
      pageSize: Number(url.searchParams.get('pageSize') ?? 25),
    })
    return Response.json(result)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

// POST /api/v1/entities
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const entity = await service.createEntity(body)
    return Response.json(entity, { status: 201 })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
