import type { APIRoute } from 'astro'
import { optionalAuth, extractAppToken } from '../../../../../../server/middleware/auth'
import { verifyAppToken } from '../../../../../../server/modules/app-auth/service'
import { query } from '../../../../../../server/db/index'

function requireAnyAuth(request: Request) {
  const platform = optionalAuth(request)
  if (platform) return { type: 'platform' as const }

  const appToken = extractAppToken(request)
  if (appToken) {
    const app = verifyAppToken(appToken)
    return { type: 'app' as const, containerId: app.containerId }
  }

  throw new Error('Authentication required')
}

/**
 * GET /api/v1/containers/:id/roles
 * Returns domain roles defined for this container (from D2 exploration).
 * Used to populate domain_role dropdown in user management.
 */
export const GET: APIRoute = async ({ params, request }) => {
  try {
    requireAnyAuth(request)
    const result = await query(
      'SELECT id, name, label, description, permissions FROM cfg_roles WHERE container_id = $1 AND is_active = true ORDER BY name',
      [params.id!],
    )
    return Response.json(result.rows)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 401 })
  }
}
