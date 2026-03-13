import type { APIRoute } from 'astro'
import { authenticateAppUser } from '../../../../../../server/middleware/auth'
import { chatWithAssistant, getChatHistory } from '../../../../../../server/modules/app-assistant/service'

/**
 * POST /api/v1/apps/:slug/assistant — Send a message to the AI assistant (SSE stream)
 * GET  /api/v1/apps/:slug/assistant — Get chat history for a page context
 */

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const slug = params.slug!
    const auth = await authenticateAppUser(request, slug)

    const body = await request.json().catch(() => ({}))
    const { message, page_context, provider, model } = body

    if (!message?.trim()) {
      return Response.json({ error: 'message is required' }, { status: 400 })
    }

    const pageContext = page_context ?? { page: 'dashboard' }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        }

        try {
          await chatWithAssistant(
            {
              containerId: auth.containerId,
              userId: auth.userId,
              userRole: auth.role,
              slug,
              pageContext,
            },
            message,
            provider ?? 'ollama',
            model,
            send,
          )

          send('done', { success: true })
        } catch (err: any) {
          send('error', { error: err.message })
        }

        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 401 })
  }
}

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const slug = params.slug!
    const auth = await authenticateAppUser(request, slug)

    const url = new URL(request.url)
    const page = url.searchParams.get('page') ?? 'dashboard'
    const entityType = url.searchParams.get('entity_type') ?? undefined
    const entityId = url.searchParams.get('entity_id') ?? undefined

    const history = await getChatHistory(
      auth.containerId,
      auth.userId,
      { page: page as any, entityType, entityId },
    )

    return Response.json({ messages: history })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 401 })
  }
}
