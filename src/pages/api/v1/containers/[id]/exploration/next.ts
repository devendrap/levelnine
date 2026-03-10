import type { APIRoute } from 'astro'
import * as explorationService from '../../../../../../../server/modules/exploration/service'
import { authenticate } from '../../../../../../../server/middleware/auth'

// POST /api/v1/containers/:id/exploration/next — execute next step (SSE)
export const POST: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
    const body = await request.json().catch(() => ({}))
    const { run_id, provider, model } = body

    if (!run_id) {
      return Response.json({ error: 'run_id is required' }, { status: 400 })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        }

        try {
          const result = await explorationService.executeNextStep(
            run_id,
            provider ?? 'ollama',
            model,
            (chunk: string) => {
              send('chunk', { text: chunk })
            },
          )

          send('step', {
            step: result.step,
            isGate: result.isGate,
            isDone: result.isDone,
          })

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
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
