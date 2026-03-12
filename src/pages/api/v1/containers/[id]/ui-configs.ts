import type { APIRoute } from 'astro'
import { optionalAuth, extractAppToken } from '../../../../../../server/middleware/auth'
import { verifyAppToken } from '../../../../../../server/modules/app-auth/service'
import { query } from '../../../../../../server/db/index'

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

/**
 * GET /api/v1/containers/:id/ui-configs
 * Returns D10 UI configuration for rendering MasterDetail + DataGrid views.
 * Optionally filter by entity_type query param.
 */
export const GET: APIRoute = async ({ params, url, request }) => {
  try {
    requireAnyAuth(request)
    const containerId = params.id!
    const entityType = url.searchParams.get('entity_type')

    const conditions = ['container_id = $1']
    const queryParams: any[] = [containerId]

    if (entityType) {
      conditions.push('entity_type = $2')
      queryParams.push(entityType)
    }

    const result = await query(
      `SELECT * FROM cfg_ui_configs WHERE ${conditions.join(' AND ')} ORDER BY name`,
      queryParams,
    )

    return Response.json(result.rows)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 401 })
  }
}
