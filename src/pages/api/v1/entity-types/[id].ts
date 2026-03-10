import type { APIRoute } from 'astro'
import * as service from '../../../../../server/modules/entities/service'

// GET /api/v1/entity-types/:id
export const GET: APIRoute = async ({ params }) => {
  try {
    const et = await service.getEntityType(params.id!)
    return Response.json(et)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

// PUT /api/v1/entity-types/:id
export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const body = await request.json()
    const et = await service.updateEntityType(params.id!, body)
    return Response.json(et)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
