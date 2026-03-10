import type { APIRoute } from 'astro'
import * as service from '../../../../../server/modules/entities/service'

// GET /api/v1/entity-types
export const GET: APIRoute = async () => {
  try {
    const types = await service.listEntityTypes()
    return Response.json(types)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

// POST /api/v1/entity-types
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const et = await service.createEntityType(body)
    return Response.json(et, { status: 201 })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
