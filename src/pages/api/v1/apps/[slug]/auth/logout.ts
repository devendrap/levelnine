import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ params }) => {
  const secure = import.meta.env.PROD ? '; Secure' : ''
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `app_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
    },
  })
}
