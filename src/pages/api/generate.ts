import type { APIRoute } from 'astro'
import { generateUI } from '../../api/generate'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

const PREVIEWS_DIR = join(process.cwd(), '.previews')
const SPECS_FILE = join(PREVIEWS_DIR, 'specs.json')

function readStore(): Record<string, unknown> {
  try { return JSON.parse(readFileSync(SPECS_FILE, 'utf-8')) } catch { return {} }
}

function saveSpec(spec: unknown): string {
  const store = readStore()
  const id = randomUUID().slice(0, 8)
  store[id] = spec
  mkdirSync(PREVIEWS_DIR, { recursive: true })
  writeFileSync(SPECS_FILE, JSON.stringify(store, null, 2))
  return id
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { prompt, provider, model } = await request.json()
    if (!prompt || !provider) {
      return new Response(JSON.stringify({ error: 'Missing prompt or provider' }), { status: 400 })
    }

    const spec = await generateUI({ prompt, provider, model })
    const id = saveSpec(spec)

    return new Response(JSON.stringify({ spec, previewUrl: `/preview/${id}` }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}
