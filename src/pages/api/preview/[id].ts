import type { APIRoute } from 'astro'
import { readFileSync } from 'fs'
import { join } from 'path'

const PREVIEWS_DIR = join(process.cwd(), '.previews')
const SPECS_FILE = join(PREVIEWS_DIR, 'specs.json')

function readStore(): Record<string, unknown> {
  try { return JSON.parse(readFileSync(SPECS_FILE, 'utf-8')) } catch { return {} }
}

export const GET: APIRoute = ({ params }) => {
  const store = readStore()
  const spec = store[params.id!]
  if (spec) {
    return new Response(JSON.stringify(spec), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return new Response(JSON.stringify({ error: 'Preview not found' }), { status: 404 })
}
