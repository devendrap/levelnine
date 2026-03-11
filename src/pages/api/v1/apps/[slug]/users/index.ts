import type { APIRoute } from 'astro'
import { authenticateAppUser, requireAppRole } from '../../../../../../../server/middleware/auth'
import * as appAuth from '../../../../../../../server/modules/app-auth/service'
import * as containerService from '../../../../../../../server/modules/containers/service'

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const auth = await authenticateAppUser(request, params.slug!)
    requireAppRole(auth, 'admin')

    const container = await containerService.getContainerBySlug(params.slug!)
    const users = await appAuth.listUsers(container.id)
    return Response.json(users)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const auth = await authenticateAppUser(request, params.slug!)
    requireAppRole(auth, 'admin')

    const container = await containerService.getContainerBySlug(params.slug!)
    const body = await request.json()

    const { user } = await appAuth.inviteUser({
      containerId: container.id,
      email: body.email,
      name: body.name,
      role: body.role ?? 'editor',
      invitedBy: auth.userId,
    })

    return Response.json({ user, invited: true }, { status: 201 })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
