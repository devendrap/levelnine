import type { APIRoute } from 'astro'
import { authenticate, optionalAuth } from '../../../../../server/middleware/auth'
import { extractAppToken } from '../../../../../server/middleware/auth'
import { verifyAppToken } from '../../../../../server/modules/app-auth/service'
import * as service from '../../../../../server/modules/entities/service'
import { ValidationError } from '../../../../../server/modules/entities/service'
import { checkRoleAccess } from '../../../../../server/modules/runtime/enforcement'
import * as security from '../../../../../server/modules/security/service'

/** Accept either platform admin token or app_token */
function requireAnyAuth(request: Request) {
  // Try platform token
  const platform = optionalAuth(request)
  if (platform) return { type: 'platform' as const, userId: platform.userId, role: platform.role, domainRole: null as string | null }

  // Try app token
  const appToken = extractAppToken(request)
  if (appToken) {
    const app = verifyAppToken(appToken)
    return { type: 'app' as const, userId: app.userId, role: app.role, domainRole: app.domainRole, containerId: app.containerId }
  }

  throw new Error('Authentication required')
}

// GET /api/v1/entities?type=X&parent=Y&status=Z&period=P&page=1&pageSize=25&container_id=X
export const GET: APIRoute = async ({ url, request }) => {
  try {
    const auth = requireAnyAuth(request)
    const containerId = url.searchParams.get('container_id') ?? undefined
    const typeName = url.searchParams.get('type') ?? undefined

    const result = await service.listEntities({
      type: typeName,
      parent: url.searchParams.get('parent') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      period: url.searchParams.get('period') ?? undefined,
      container_id: containerId,
      page: Number(url.searchParams.get('page') ?? 1),
      pageSize: Number(url.searchParams.get('pageSize') ?? 25),
    })

    // Apply field-level security masking on list results (C4)
    if (containerId && typeName) {
      const classifications = await security.getClassifications(containerId, typeName)
      if (classifications.length > 0) {
        for (const entity of result.data) {
          if (entity.content) {
            entity.content = security.maskContent(entity.content as Record<string, any>, classifications, auth.role)
          }
        }
      }
    }

    return Response.json(result)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 401 })
  }
}

// POST /api/v1/entities
export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = requireAnyAuth(request)
    const body = await request.json()

    // App users can only create in their own container
    if (auth.type === 'app' && body.container_id && body.container_id !== auth.containerId) {
      return Response.json({ error: 'Cannot create entities in another app' }, { status: 403 })
    }
    // Viewers cannot create
    if (auth.role === 'viewer') {
      return Response.json({ error: 'Viewers cannot create entities' }, { status: 403 })
    }

    // Role-based entity type access check (Step 7)
    if (auth.type === 'app' && auth.containerId && body.entity_type_name) {
      const roleForAccess = auth.domainRole ?? auth.role
      const access = await checkRoleAccess(auth.containerId, roleForAccess, body.entity_type_name)
      if (!access.allowed) {
        return Response.json({ error: access.reason }, { status: 403 })
      }
    }

    const entity = await service.createEntity({
      ...body,
      created_by_user_id: auth.userId,
    })
    return Response.json(entity, { status: 201 })
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return Response.json({ error: err.message, errors: err.errors, warnings: err.warnings }, { status: 422 })
    }
    return Response.json({ error: err.message }, { status: err.status ?? 401 })
  }
}
