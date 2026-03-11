import type { APIRoute } from 'astro'
import { authenticateAppUser } from '../../../../../../../server/middleware/auth'
import * as appAuth from '../../../../../../../server/modules/app-auth/service'

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const auth = await authenticateAppUser(request, params.slug!)
    const user = await appAuth.me(auth.userId)
    return Response.json({ user })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
