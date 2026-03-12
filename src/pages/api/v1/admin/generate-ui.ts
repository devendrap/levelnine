import type { APIRoute } from 'astro'
import { authenticate, requireRole } from '../../../../../server/middleware/auth'
import { generateUI } from '../../../../api/generate'
import type { Provider } from '../../../../api/providers'

/**
 * POST /api/v1/admin/generate-ui
 * Admin-only: Generate a UI spec via LLM.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = authenticate(request)
    requireRole(auth, 'admin')

    const body = await request.json()
    const { prompt, provider = 'gemini', model } = body

    if (!prompt) {
      return Response.json({ error: 'prompt is required' }, { status: 400 })
    }

    const spec = await generateUI({ prompt, provider: provider as Provider, model })

    return Response.json({ spec })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
