import type { APIRoute } from 'astro'
import { optionalAuth, extractAppToken } from '../../../../../../../server/middleware/auth'
import { verifyAppToken } from '../../../../../../../server/modules/app-auth/service'
import { getWorkflowInfo } from '../../../../../../../server/modules/runtime/enforcement'

function requireAnyAuth(request: Request) {
  const platform = optionalAuth(request)
  if (platform) return { type: 'platform' as const, role: platform.role }

  const appToken = extractAppToken(request)
  if (appToken) {
    const app = verifyAppToken(appToken)
    return { type: 'app' as const, role: app.role, containerId: app.containerId }
  }

  throw new Error('Authentication required')
}

/**
 * GET /api/v1/containers/:id/workflows/:entityType?status=CURRENT_STATUS
 * Returns workflow definition + available transitions for the entity type.
 */
export const GET: APIRoute = async ({ params, url, request }) => {
  try {
    const auth = requireAnyAuth(request)
    const containerId = params.id!
    const entityType = params.entityType!
    const currentStatus = url.searchParams.get('status') ?? undefined

    const info = await getWorkflowInfo(containerId, entityType, currentStatus, auth.role)
    return Response.json(info)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 401 })
  }
}
