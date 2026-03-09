import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PREVIEWS_DIR = join(__dirname, '../../.previews')
const PREVIEWS_FILE = join(PREVIEWS_DIR, 'specs.json')

function readStore(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(PREVIEWS_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function writeStore(store: Record<string, unknown>) {
  mkdirSync(PREVIEWS_DIR, { recursive: true })
  writeFileSync(PREVIEWS_FILE, JSON.stringify(store, null, 2))
}

export function savePreview(spec: unknown): string {
  const id = randomUUID().slice(0, 8)
  const store = readStore()
  store[id] = spec
  writeStore(store)
  return id
}

export function getPreview(id: string): unknown | null {
  return readStore()[id] ?? null
}

export function listPreviews(): string[] {
  return Object.keys(readStore())
}
