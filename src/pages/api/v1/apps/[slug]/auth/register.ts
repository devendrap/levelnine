import type { APIRoute } from 'astro'
import * as appAuth from '../../../../../../../server/modules/app-auth/service'

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const body = await request.json()
    const { user, token } = await appAuth.register({
      slug: params.slug!,
      email: body.email,
      name: body.name,
      password: body.password,
    })

    const secure = import.meta.env.PROD ? '; Secure' : ''
    return new Response(JSON.stringify({ user }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `app_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${secure}`,
      },
    })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
