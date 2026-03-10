import type { APIRoute } from 'astro'
import { login } from '../../../../../server/modules/auth/service'

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const { user, token } = await login(body)

    return new Response(JSON.stringify({ user }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${import.meta.env.PROD ? '; Secure' : ''}`,
      },
    })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
