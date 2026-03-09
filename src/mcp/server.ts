console.error('[ai-ui] Starting MCP server...')

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { ComponentSchema } from '../catalog/schemas'
import { generatePrompt } from '../catalog/prompt'
import { savePreview, getPreview, listPreviews } from './previews'

process.on('uncaughtException', (err) => { console.error('[ai-ui] Uncaught:', err) })
process.on('unhandledRejection', (err) => { console.error('[ai-ui] Unhandled rejection:', err) })

const catalogText = generatePrompt()

const server = new McpServer({
  name: 'ai-ui',
  version: '0.1.0',
})

// Resource: catalog
server.registerResource('catalog', 'ui://catalog', {
  description: 'Component catalog with available UI components, their props, and descriptions',
}, async () => ({
  contents: [{
    uri: 'ui://catalog',
    mimeType: 'text/plain',
    text: catalogText,
  }],
}))

// Resource: preview by ID
server.registerResource(
  'preview',
  new ResourceTemplate('ui://preview/{id}', { list: async () => {
    const ids = listPreviews()
    return { resources: ids.map(id => ({ uri: `ui://preview/${id}`, name: `Preview ${id}` })) }
  }}),
  { description: 'Read a stored preview spec by ID' },
  async (uri, variables) => {
    const id = variables.id as string
    const spec = getPreview(id)
    if (!spec) {
      return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: `Preview ${id} not found` }] }
    }
    return {
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(spec, null, 2),
      }],
    }
  },
)

function parseAndValidate(specInput: string) {
  let raw: unknown
  if (typeof specInput === 'string') {
    try { raw = JSON.parse(specInput) } catch (e: any) {
      return { success: false as const, error: `Invalid JSON: ${e.message}` }
    }
  } else {
    raw = specInput
  }
  const result = ComponentSchema.safeParse(raw)
  if (!result.success) {
    const errors = result.error.issues.map((i: { path: PropertyKey[]; message: string }) => `${i.path.join('.')}: ${i.message}`)
    return { success: false as const, error: errors.join('\n') }
  }
  return { success: true as const, data: result.data }
}

// Tool: get_catalog
server.registerTool('get_catalog', {
  description: 'Get the full UI component catalog. Call this FIRST to learn what components are available before generating a spec.',
}, async () => ({
  content: [{ type: 'text' as const, text: catalogText }],
}))

// Tool: render_preview
server.registerTool('render_preview', {
  description: `Validate and render a UI JSON spec. Returns a preview URL.

Call get_catalog first to see available components.

The spec param is a JSON string. Example:
{"type":"Stack","props":{"gap":"4"},"children":[{"type":"Heading","props":{"level":1,"content":"Hello"}},{"type":"Text","props":{"content":"World","variant":"body"}}]}`,
  inputSchema: {
    spec: z.string().describe('JSON string of the UI spec: {"type":"...","props":{...},"children":[...]}'),
  },
}, async ({ spec }) => {
  const result = parseAndValidate(spec)
  if (!result.success) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ valid: false, errors: result.error }, null, 2) }],
      isError: true,
    }
  }
  const id = savePreview(result.data)
  const url = `http://localhost:5173/preview/${id}`
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ valid: true, id, url }, null, 2) }],
  }
})

// Tool: validate_ui_spec
server.registerTool('validate_ui_spec', {
  description: 'Validate a UI JSON spec without rendering. Returns success or errors.',
  inputSchema: {
    spec: z.string().describe('JSON string of the UI spec to validate'),
  },
}, async ({ spec }) => {
  const result = parseAndValidate(spec)
  if (!result.success) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ valid: false, errors: result.error }, null, 2) }],
      isError: true,
    }
  }
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ valid: true }, null, 2) }],
  }
})

// Tool: list_previews
server.registerTool('list_previews', {
  description: 'List all stored preview IDs',
}, async () => {
  const ids = listPreviews()
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ previews: ids }, null, 2) }],
  }
})

try {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[ai-ui] MCP server connected and ready')
  setInterval(() => {}, 1 << 30)
} catch (err) {
  console.error('[ai-ui] Failed to start:', err)
  process.exit(1)
}
