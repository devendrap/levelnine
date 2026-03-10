import type { APIRoute } from 'astro'
import { authenticateAppUser, requireAppRole } from '../../../../../../../server/middleware/auth'
import * as appAuth from '../../../../../../../server/modules/app-auth/service'

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const auth = authenticateAppUser(request, params.slug!)
    requireAppRole(auth, 'admin')

    const body = await request.json()
    const user = await appAuth.updateUser(params.id!, {
      role: body.role,
      is_active: body.is_active,
    })
    return Response.json(user)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const auth = authenticateAppUser(request, params.slug!)
    requireAppRole(auth, 'admin')

    await appAuth.removeUser(params.id!)
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
