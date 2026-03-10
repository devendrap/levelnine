import type { APIRoute } from 'astro'
import * as containerService from '../../../../../../server/modules/containers/service'
import { authenticate } from '../../../../../../server/middleware/auth'

// PUT /api/v1/containers/:id/manifest — apply manifest update
export const PUT: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const manifest = await request.json()
    const container = await containerService.applyManifest(params.id!, manifest)
    return Response.json(container)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
