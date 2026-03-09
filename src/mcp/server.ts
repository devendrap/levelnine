import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { ComponentSchema } from '../catalog/schemas.js'
import { generatePrompt } from '../catalog/prompt.js'
import { savePreview, getPreview, listPreviews } from './previews.js'

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
    text: generatePrompt(),
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

// Tool: validate_ui_spec
server.registerTool('validate_ui_spec', {
  description: 'Validate a UI JSON spec against the component catalog schema. Returns success or detailed Zod errors.',
  inputSchema: {
    spec: z.any().describe('The UI JSON spec to validate'),
  },
}, async ({ spec }) => {
  const result = ComponentSchema.safeParse(spec)
  if (result.success) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ valid: true, spec: result.data }, null, 2) }],
    }
  }
  const errors = result.error.issues.map((i: { path: PropertyKey[]; message: string }) => `${i.path.join('.')}: ${i.message}`)
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ valid: false, errors }, null, 2) }],
    isError: true,
  }
})

// Tool: render_preview
server.registerTool('render_preview', {
  description: 'Validate and store a UI spec, returning a preview URL. Open this URL in a browser to see the rendered UI.',
  inputSchema: {
    spec: z.any().describe('The UI JSON spec to render'),
  },
}, async ({ spec }) => {
  const result = ComponentSchema.safeParse(spec)
  if (!result.success) {
    const errors = result.error.issues.map((i: { path: PropertyKey[]; message: string }) => `${i.path.join('.')}: ${i.message}`)
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ valid: false, errors }, null, 2) }],
      isError: true,
    }
  }
  const id = savePreview(result.data)
  const url = `http://localhost:5173/preview/${id}`
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ valid: true, id, url }, null, 2) }],
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

const transport = new StdioServerTransport()
await server.connect(transport)
