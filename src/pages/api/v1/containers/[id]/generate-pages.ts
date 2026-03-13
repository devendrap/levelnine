import type { APIRoute } from 'astro'
import * as containerService from '../../../../../../server/modules/containers/service'
import { authenticate } from '../../../../../../server/middleware/auth'

// POST /api/v1/containers/:id/generate-pages — generate D11 pages + seed data
export const POST: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 401 })
  }

  const body = await request.json().catch(() => ({}))
  const provider = body.provider ?? 'ollama'
  const model = body.model

  try {
    const result = await containerService.generatePagesAndSeed(
      params.id!,
      provider,
      model,
    )

    return Response.json(result)
  } catch (err: any) {
    const status = err.status ?? 500
    return Response.json({ error: err.message }, { status })
  }
}
