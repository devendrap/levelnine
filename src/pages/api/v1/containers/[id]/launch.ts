import type { APIRoute } from 'astro'
import * as containerService from '../../../../../../server/modules/containers/service'
import { authenticate } from '../../../../../../server/middleware/auth'

// POST /api/v1/containers/:id/launch — launch a locked container as a live app
export const POST: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const container = await containerService.launchContainer(params.id!)
    return Response.json({ container, appUrl: `/apps/${container.slug}` })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
