import { defineConfig, envField } from 'astro/config'
import solid from '@astrojs/solid-js'
import tailwindcss from '@tailwindcss/vite'
import node from '@astrojs/node'

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [solid()],
  env: {
    schema: {
      // Auth
      JWT_SECRET: envField.string({ context: 'server', access: 'secret' }),
      JWT_EXPIRES_IN: envField.string({ context: 'server', access: 'secret', default: '24h' }),

      // Database
      DB_HOST: envField.string({ context: 'server', access: 'secret', default: 'localhost' }),
      DB_PORT: envField.number({ context: 'server', access: 'secret', default: 5433 }),
      DB_USER: envField.string({ context: 'server', access: 'secret', default: 'aiui' }),
      DB_PASSWORD: envField.string({ context: 'server', access: 'secret', default: 'aiui_dev' }),
      DB_NAME: envField.string({ context: 'server', access: 'secret', default: 'aiui' }),

      // S3 / MinIO
      S3_ENDPOINT: envField.string({ context: 'server', access: 'secret', default: 'http://localhost:9000' }),
      S3_REGION: envField.string({ context: 'server', access: 'secret', default: 'us-east-1' }),
      S3_ACCESS_KEY: envField.string({ context: 'server', access: 'secret', default: 'aiui' }),
      S3_SECRET_KEY: envField.string({ context: 'server', access: 'secret', default: 'aiui_dev_secret' }),
      S3_BUCKET: envField.string({ context: 'server', access: 'secret', default: 'levelnine-uploads' }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: ['app.levelnine.ai'],
    },
    ssr: {
      noExternal: ['@nanostores/solid', 'nanostores'],
    },
  },
})
