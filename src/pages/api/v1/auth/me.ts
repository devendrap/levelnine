import type { APIRoute } from 'astro'
import { me } from '../../../../../server/modules/auth/service'
import { authenticate } from '../../../../../server/middleware/auth'

export const GET: APIRoute = async ({ request }) => {
  try {
    const auth = authenticate(request)
    const user = await me(auth.userId)
    return Response.json({ user })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 401 })
  }
}
