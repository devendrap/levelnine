import type { APIRoute } from 'astro'
import { authenticate } from '../../../../../../server/middleware/auth'
import * as security from '../../../../../../server/modules/security/service'
import { query } from '../../../../../../server/db/index'

/**
 * GET /api/v1/containers/:id/classifications?entity_type=X
 * List field classifications for a container.
 */
export const GET: APIRoute = async ({ params, url, request }) => {
  try {
    authenticate(request)
    const containerId = params.id!
    const entityType = url.searchParams.get('entity_type')

    const conditions = ['container_id = $1']
    const queryParams: any[] = [containerId]

    if (entityType) {
      conditions.push('entity_type = $2')
      queryParams.push(entityType)
    }

    const result = await query(
      `SELECT * FROM data_classifications WHERE ${conditions.join(' AND ')} ORDER BY entity_type, field_path`,
      queryParams,
    )
    return Response.json(result.rows)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 401 })
  }
}

/**
 * POST /api/v1/containers/:id/classifications
 * Create or update a field classification.
 */
export const POST: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const containerId = params.id!
    const body = await request.json()

    if (!body.entity_type || !body.field_path || !body.classification) {
      return Response.json({ error: 'entity_type, field_path, and classification are required' }, { status: 400 })
    }

    const valid = ['public', 'internal', 'confidential', 'pii']
    if (!valid.includes(body.classification)) {
      return Response.json({ error: `classification must be one of: ${valid.join(', ')}` }, { status: 400 })
    }

    const result = await security.classifyField(
      containerId,
      body.entity_type,
      body.field_path,
      body.classification,
      body.mask_for_roles ?? [],
    )
    return Response.json(result, { status: 201 })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

/**
 * DELETE /api/v1/containers/:id/classifications
 * Remove a field classification by entity_type + field_path.
 */
export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const containerId = params.id!
    const body = await request.json()

    if (!body.entity_type || !body.field_path) {
      return Response.json({ error: 'entity_type and field_path are required' }, { status: 400 })
    }

    await query(
      'DELETE FROM data_classifications WHERE container_id = $1 AND entity_type = $2 AND field_path = $3',
      [containerId, body.entity_type, body.field_path],
    )
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
