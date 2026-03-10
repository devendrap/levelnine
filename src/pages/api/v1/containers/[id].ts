import type { APIRoute } from 'astro'
import * as containerService from '../../../../../server/modules/containers/service'
import { authenticate } from '../../../../../server/middleware/auth'

// GET /api/v1/containers/:id
export const GET: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const container = await containerService.getContainer(params.id!)
    const messages = await containerService.getMessages(params.id!)
    return Response.json({ container, messages })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

// PUT /api/v1/containers/:id
export const PUT: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const body = await request.json()
    const container = await containerService.updateContainer(params.id!, body)
    return Response.json(container)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

// DELETE /api/v1/containers/:id
export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    await containerService.deleteContainer(params.id!)
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
