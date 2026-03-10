import type { APIRoute } from 'astro'
import * as containerService from '../../../../../server/modules/containers/service'
import { authenticate } from '../../../../../server/middleware/auth'

// GET /api/v1/containers — list all containers
export const GET: APIRoute = async ({ request }) => {
  try {
    authenticate(request)
    const containers = await containerService.listContainers()
    return Response.json(containers)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

// POST /api/v1/containers — create new container
export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = authenticate(request)
    const body = await request.json()
    const container = await containerService.createContainer({
      ...body,
      created_by_user_id: auth.userId,
    })
    return Response.json(container, { status: 201 })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
