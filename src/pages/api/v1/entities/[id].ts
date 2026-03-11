import type { APIRoute } from 'astro'
import { optionalAuth, extractAppToken } from '../../../../../server/middleware/auth'
import { verifyAppToken } from '../../../../../server/modules/app-auth/service'
import * as service from '../../../../../server/modules/entities/service'
import { ValidationError } from '../../../../../server/modules/entities/service'
import * as security from '../../../../../server/modules/security/service'

function requireAnyAuth(request: Request) {
  const platform = optionalAuth(request)
  if (platform) return { type: 'platform' as const, userId: platform.userId, role: platform.role }

  const appToken = extractAppToken(request)
  if (appToken) {
    const app = verifyAppToken(appToken)
    return { type: 'app' as const, userId: app.userId, role: app.role, containerId: app.containerId }
  }

  throw new Error('Authentication required')
}

// GET /api/v1/entities/:id
export const GET: APIRoute = async ({ params, request }) => {
  try {
    const auth = requireAnyAuth(request)
    const entity = await service.getEntity(params.id!)

    // Apply field-level security masking (C4)
    if (entity.container_id && entity.entity_type?.name) {
      const classifications = await security.getClassifications(entity.container_id, entity.entity_type.name)
      if (classifications.length > 0) {
        entity.content = security.maskContent(entity.content, classifications, auth.role)
      }
    }

    return Response.json(entity)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 401 })
  }
}

// PUT /api/v1/entities/:id
export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const auth = requireAnyAuth(request)
    if (auth.role === 'viewer') {
      return Response.json({ error: 'Viewers cannot edit entities' }, { status: 403 })
    }
    const body = await request.json()
    const entity = await service.updateEntity(params.id!, {
      ...body,
      last_modified_by_user_id: auth.userId,
    })
    return Response.json(entity)
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message, errors: err.errors, warnings: err.warnings }, { status: 422 })
    }
    return Response.json({ error: err.message }, { status: err.status ?? 401 })
  }
}

// DELETE /api/v1/entities/:id
export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const auth = requireAnyAuth(request)
    if (auth.type === 'app' && auth.role !== 'admin') {
      return Response.json({ error: 'Only app admins can delete entities' }, { status: 403 })
    }
    await service.deleteEntity(params.id!)
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 401 })
  }
}
