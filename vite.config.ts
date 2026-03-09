import { defineConfig, type Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import solid from 'vite-plugin-solid'
import { readFileSync } from 'fs'
import { join } from 'path'

function previewApi(): Plugin {
  const specsFile = join(__dirname, '.previews', 'specs.json')
  return {
    name: 'preview-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/preview/')) {
          const id = req.url.slice('/api/preview/'.length)
          try {
            const store = JSON.parse(readFileSync(specsFile, 'utf-8'))
            const spec = store[id]
            if (spec) {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(spec))
              return
            }
          } catch {}
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'Preview not found' }))
          return
        }
        // Serve index.html for /preview/* routes (SPA fallback)
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
