import type { APIRoute } from 'astro'

export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
    },
  })
}
