import type { APIRoute } from 'astro'
import * as containerService from '../../../../../../server/modules/containers/service'
import { authenticate } from '../../../../../../server/middleware/auth'

// POST /api/v1/containers/:id/entity-types — save entity types to manifest
export const POST: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const { entity_types } = await request.json()
    if (!Array.isArray(entity_types) || entity_types.length === 0) {
      return Response.json({ error: 'entity_types array is required' }, { status: 400 })
    }
    const container = await containerService.saveEntityTypes(params.id!, entity_types)
    return Response.json(container)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

// DELETE /api/v1/containers/:id/entity-types — remove entity types from manifest
export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const { names } = await request.json()
    if (!Array.isArray(names) || names.length === 0) {
      return Response.json({ error: 'names array is required' }, { status: 400 })
    }
    const container = await containerService.removeEntityTypes(params.id!, names)
    return Response.json(container)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
