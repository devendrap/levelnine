import type { APIRoute } from 'astro'
import * as service from '../../../../../server/modules/entities/service'

// GET /api/v1/entities/:id
export const GET: APIRoute = async ({ params }) => {
  try {
    const entity = await service.getEntity(params.id!)
    return Response.json(entity)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

// PUT /api/v1/entities/:id
export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const body = await request.json()
    const entity = await service.updateEntity(params.id!, body)
    return Response.json(entity)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

// DELETE /api/v1/entities/:id
export const DELETE: APIRoute = async ({ params }) => {
  try {
    await service.deleteEntity(params.id!)
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
