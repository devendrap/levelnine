import { defineConfig, type Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import solid from 'vite-plugin-solid'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

const PREVIEWS_DIR = join(__dirname, '.previews')
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

function previewApi(): Plugin {
  return {
    name: 'preview-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // POST /api/generate
        if (req.url === '/api/generate' && req.method === 'POST') {
          let body = ''
          for await (const chunk of req) body += chunk
          try {
            const { prompt, provider, model } = JSON.parse(body)
            if (!prompt || !provider) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Missing prompt or provider' }))
              return
            }
            // Dynamic import to keep vite config light
            const { generateUI } = await import('./src/api/generate')
            const spec = await generateUI({ prompt, provider, model })
            const id = saveSpec(spec)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ spec, previewUrl: `http://localhost:5173/preview/${id}` }))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }

        // GET /api/preview/:id
        if (req.url?.startsWith('/api/preview/')) {
          const id = req.url.slice('/api/preview/'.length)
          const store = readStore()
          if (store[id]) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(store[id]))
          } else {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'Preview not found' }))
          }
          return
        }

        // SPA fallback for /preview/*
        if (req.url?.startsWith('/preview/')) {
          req.url = '/'
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [previewApi(), tailwindcss(), solid()],
})
