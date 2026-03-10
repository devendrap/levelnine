import type { APIRoute } from 'astro'
import * as containerService from '../../../../../../server/modules/containers/service'
import { authenticate } from '../../../../../../server/middleware/auth'

// POST /api/v1/containers/:id/chat — send message, get LLM reply
export const POST: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const { message, provider, model } = await request.json()
    if (!message?.trim()) {
      return Response.json({ error: 'Message is required' }, { status: 400 })
    }

    const { reply, container } = await containerService.chat(
      params.id!,
      message,
      provider ?? 'ollama',
      model,
    )

    return Response.json({ reply, container })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
