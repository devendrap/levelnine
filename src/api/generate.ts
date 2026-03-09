import { getClient, getModel, type Provider } from './providers'
import { generatePrompt } from '../catalog/prompt'
import { ComponentSchema } from '../catalog/schemas'

const systemPrompt = generatePrompt() + '\n\nRespond with ONLY the JSON spec. No markdown, no code fences, no explanation.'

function parseResponse(content: string) {
  const cleaned = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  const raw = JSON.parse(cleaned)
  const result = ComponentSchema.safeParse(raw)
  if (!result.success) {
    const errors = result.error.issues.map((i: { path: PropertyKey[]; message: string }) =>
      `${i.path.join('.')}: ${i.message}`
    )
    return { success: false as const, errors }
  }
  return { success: true as const, data: result.data }
}

export async function generateUI(opts: { prompt: string; provider: Provider; model?: string }) {
  const { client } = getClient(opts.provider)
  const model = getModel(opts.provider, opts.model)
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: opts.prompt },
  ]

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
    })

    const content = response.choices[0]?.message?.content?.trim()
    if (!content) throw new Error('Empty response from LLM')

    try {
      const result = parseResponse(content)
      if (result.success) return result.data

      // Feed errors back for retry
      messages.push({ role: 'assistant', content })
      messages.push({ role: 'user', content: `Validation errors:\n${result.errors.join('\n')}\n\nFix the spec and return only valid JSON.` })
    } catch (e: any) {
      if (attempt === 2) throw new Error(`Failed after 3 attempts: ${e.message}`)
      messages.push({ role: 'assistant', content })
      messages.push({ role: 'user', content: `That was invalid JSON. Return only a valid JSON spec, no markdown.` })
    }
  }

  throw new Error('Failed to generate valid spec after 3 attempts. Last messages: ' + JSON.stringify(messages.slice(-2).map(m => m.content.slice(0, 300))))
}
