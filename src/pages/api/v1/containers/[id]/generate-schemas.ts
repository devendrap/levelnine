import type { APIRoute } from 'astro'
import * as containerService from '../../../../../../server/modules/containers/service'
import { authenticate } from '../../../../../../server/middleware/auth'

// POST /api/v1/containers/:id/generate-schemas — SSE streaming parallel schema generation
export const POST: APIRoute = async ({ params, request }) => {
  try {
    authenticate(request)
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 401 })
  }

  const body = await request.json().catch(() => ({}))
  const provider = body.provider ?? 'ollama'
  const model = body.model
  const concurrency = body.concurrency ?? 5

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      }

      try {
        const onProgress = (result: { name: string; success: boolean; error?: string; index: number; total: number }) => {
          send('progress', result)
        }

        const { container, results } = await containerService.generateAllSchemas(
          params.id!,
          provider,
          model,
          concurrency,
          onProgress,
        )

        const succeeded = results.filter(r => r.success).length
        const failed = results.filter(r => !r.success).length
        send('done', { summary: { total: results.length, succeeded, failed }, results })
      } catch (err: any) {
        send('error', { error: err.message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
