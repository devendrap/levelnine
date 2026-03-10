import type { APIRoute } from 'astro'
import * as relationService from '../../../../server/modules/relations/service'
import { authenticate } from '../../../../server/middleware/auth'

// POST /api/v1/relations — create a relation
export const POST: APIRoute = async ({ request }) => {
  try {
    authenticate(request)
    const body = await request.json()
    const { source_entity_id, target_entity_id, relation_type, metadata } = body

    if (!source_entity_id || !target_entity_id || !relation_type) {
      return Response.json({ error: 'source_entity_id, target_entity_id, and relation_type are required' }, { status: 400 })
    }

    const relation = await relationService.linkEntities({
      source_entity_id,
      target_entity_id,
      relation_type,
      metadata,
    })
    return Response.json(relation, { status: 201 })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

// DELETE /api/v1/relations — delete a relation
export const DELETE: APIRoute = async ({ request }) => {
  try {
    authenticate(request)
    const body = await request.json()
    const { source_entity_id, target_entity_id, relation_type } = body

    if (!source_entity_id || !target_entity_id || !relation_type) {
      return Response.json({ error: 'source_entity_id, target_entity_id, and relation_type are required' }, { status: 400 })
    }

    await relationService.unlinkEntities(source_entity_id, target_entity_id, relation_type)
    return Response.json({ deleted: true })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
