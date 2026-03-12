import type { APIRoute } from 'astro'
import { authenticate, requireRole } from '../../../../../server/middleware/auth'
import { getClient, getModel, type Provider } from '../../../../api/providers'

/**
 * POST /api/v1/admin/generate-descriptor
 * Admin-only: Raw LLM call that returns parsed JSON without ComponentSchema validation.
 * Used for flat dashboard descriptors that code maps to UI specs.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = authenticate(request)
    requireRole(auth, 'admin')

    const body = await request.json()
    const { prompt, provider = 'ollama', model } = body

    if (!prompt) {
      return Response.json({ error: 'prompt is required' }, { status: 400 })
    }

    const { client } = getClient(provider as Provider)
    const modelId = getModel(provider as Provider, model)

    const response = await client.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: 'You are a data visualization assistant. Return ONLY valid JSON, no markdown fences, no explanation.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    })

    const content = response.choices[0]?.message?.content?.trim()
    if (!content) {
      return Response.json({ error: 'Empty response from LLM' }, { status: 502 })
    }

    // Strip code fences if present
    const cleaned = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

    try {
      const descriptor = JSON.parse(cleaned)
      return Response.json({ descriptor })
    } catch {
      return Response.json({ error: 'LLM returned invalid JSON', raw: cleaned.slice(0, 500) }, { status: 422 })
    }
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
