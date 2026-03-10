import { defineConfig } from 'astro/config'
import solid from '@astrojs/solid-js'
import tailwindcss from '@tailwindcss/vite'
import node from '@astrojs/node'

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [solid()],
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['@nanostores/solid', 'nanostores'],
    },
  },
})
