console.error('[ai-ui] Starting MCP server...')

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { ComponentSchema } from '../catalog/schemas'
import { generatePrompt } from '../catalog/prompt'
import { savePreview, getPreview, listPreviews } from './previews'
import * as entityService from '../../server/modules/entities/service'
import * as containerService from '../../server/modules/containers/service'
import * as relationService from '../../server/modules/relations/service'

process.on('uncaughtException', (err) => { console.error('[ai-ui] Uncaught:', err) })
process.on('unhandledRejection', (err) => { console.error('[ai-ui] Unhandled rejection:', err) })

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4321'
const catalogText = generatePrompt()

const server = new McpServer({
  name: 'ai-ui',
  version: '0.2.0',
})

// ─── Resources ───────────────────────────────────────────────

server.registerResource('catalog', 'ui://catalog', {
  description: 'Component catalog with available UI components, their props, and descriptions',
}, async () => ({
  contents: [{
    uri: 'ui://catalog',
    mimeType: 'text/plain',
    text: catalogText,
  }],
}))

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

// ─── Helpers ─────────────────────────────────────────────────

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

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function err(message: string) {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }, null, 2) }], isError: true }
}

// ─── Catalog & Preview Tools ─────────────────────────────────

server.registerTool('get_catalog', {
  description: 'Get the full UI component catalog. Call this FIRST to learn what components are available before generating a spec.',
}, async () => ({
  content: [{ type: 'text' as const, text: catalogText }],
}))

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
  if (!result.success) return err(result.error)
  const id = savePreview(result.data)
  return ok({ valid: true, id, url: `${BASE_URL}/preview/${id}` })
})

server.registerTool('validate_ui_spec', {
  description: 'Validate a UI JSON spec without rendering. Returns success or errors.',
  inputSchema: {
    spec: z.string().describe('JSON string of the UI spec to validate'),
  },
}, async ({ spec }) => {
  const result = parseAndValidate(spec)
  if (!result.success) return err(result.error)
  return ok({ valid: true })
})

server.registerTool('list_previews', {
  description: 'List all stored preview IDs',
}, async () => ok({ previews: listPreviews() }))

// ─── Entity Type Tools ───────────────────────────────────────

server.registerTool('list_entity_types', {
  description: 'List all active entity types. Returns array of {id, name, description, schema, is_active}.',
}, async () => {
  try {
    const types = await entityService.listEntityTypes()
    return ok(types)
  } catch (e: any) { return err(e.message) }
})

server.registerTool('get_entity_type', {
  description: 'Get a single entity type by ID.',
  inputSchema: {
    id: z.string().describe('UUID of the entity type'),
  },
}, async ({ id }) => {
  try {
    const et = await entityService.getEntityType(id)
    return ok(et)
  } catch (e: any) { return err(e.message) }
})

server.registerTool('create_entity_type', {
  description: 'Create a new entity type with a name, optional description, and optional ai-ui JSON schema.',
  inputSchema: {
    name: z.string().describe('Unique name for the entity type'),
    description: z.string().describe('Description of the entity type').optional(),
    schema: z.string().describe('JSON string of the ai-ui UI spec for this entity type').optional(),
  },
}, async ({ name, description, schema }) => {
  try {
    const parsed = schema ? JSON.parse(schema) : undefined
    const et = await entityService.createEntityType({ name, description, schema: parsed })
    return ok(et)
  } catch (e: any) { return err(e.message) }
})

server.registerTool('update_entity_type', {
  description: 'Update an existing entity type. Provide only the fields to change.',
  inputSchema: {
    id: z.string().describe('UUID of the entity type to update'),
    name: z.string().describe('New name').optional(),
    description: z.string().describe('New description').optional(),
    schema: z.string().describe('JSON string of the new ai-ui UI spec').optional(),
  },
}, async ({ id, name, description, schema }) => {
  try {
    const data: any = {}
    if (name) data.name = name
    if (description) data.description = description
    if (schema) data.schema = JSON.parse(schema)
    const et = await entityService.updateEntityType(id, data)
    return ok(et)
  } catch (e: any) { return err(e.message) }
})

// ─── Entity Tools ────────────────────────────────────────────

server.registerTool('list_entities', {
  description: 'List entities with optional filters. Returns paginated results.',
  inputSchema: {
    type: z.string().describe('Filter by entity type name').optional(),
    status: z.string().describe('Filter by status: draft|active|review|approved|archived').optional(),
    period: z.string().describe('Filter by period').optional(),
    page: z.string().describe('Page number (default 1)').optional(),
    page_size: z.string().describe('Items per page (default 25, max 100)').optional(),
  },
}, async ({ type, status, period, page, page_size }) => {
  try {
    const result = await entityService.listEntities({
      type, status, period,
      page: page ? parseInt(page) : undefined,
      pageSize: page_size ? parseInt(page_size) : undefined,
    })
    return ok(result)
  } catch (e: any) { return err(e.message) }
})

server.registerTool('get_entity', {
  description: 'Get a single entity by ID, including its entity type info.',
  inputSchema: {
    id: z.string().describe('UUID of the entity'),
  },
}, async ({ id }) => {
  try {
    const entity = await entityService.getEntity(id)
    return ok(entity)
  } catch (e: any) { return err(e.message) }
})

server.registerTool('create_entity', {
  description: 'Create a new entity (record) for a given entity type.',
  inputSchema: {
    entity_type_name: z.string().describe('Name of the entity type (e.g. "audit_plan")'),
    name: z.string().describe('Display name for this entity'),
    content: z.string().describe('JSON string of form data (key-value pairs matching the schema bind fields)').optional(),
    status: z.string().describe('Initial status: draft|active|review|approved|archived (default draft)').optional(),
    period: z.string().describe('Period label (e.g. "2026-Q1")').optional(),
  },
}, async ({ entity_type_name, name, content, status, period }) => {
  try {
    const data: any = { entity_type_name, name }
    if (content) data.content = JSON.parse(content)
    if (status) data.status = status
    if (period) data.period = period
    const entity = await entityService.createEntity(data)
    return ok(entity)
  } catch (e: any) { return err(e.message) }
})

server.registerTool('update_entity', {
  description: 'Update an existing entity. Provide only the fields to change.',
  inputSchema: {
    id: z.string().describe('UUID of the entity to update'),
    name: z.string().describe('New display name').optional(),
    status: z.string().describe('New status: draft|active|review|approved|archived').optional(),
    content: z.string().describe('JSON string of updated form data').optional(),
    period: z.string().describe('New period label').optional(),
  },
}, async ({ id, name, status, content, period }) => {
  try {
    const data: any = {}
    if (name) data.name = name
    if (status) data.status = status
    if (content) data.content = JSON.parse(content)
    if (period) data.period = period
    const entity = await entityService.updateEntity(id, data)
    return ok(entity)
  } catch (e: any) { return err(e.message) }
})

server.registerTool('delete_entity', {
  description: 'Permanently delete an entity by ID.',
  inputSchema: {
    id: z.string().describe('UUID of the entity to delete'),
  },
}, async ({ id }) => {
  try {
    await entityService.deleteEntity(id)
    return ok({ deleted: true, id })
  } catch (e: any) { return err(e.message) }
})

// ─── Container Tools ─────────────────────────────────────────

server.registerTool('list_containers', {
  description: 'List all containers (industry application definitions).',
}, async () => {
  try {
    const containers = await containerService.listContainers()
    return ok(containers)
  } catch (e: any) { return err(e.message) }
})

server.registerTool('get_container', {
  description: 'Get a container by ID, including its manifest with entity types and navigation.',
  inputSchema: {
    id: z.string().describe('UUID of the container'),
  },
}, async ({ id }) => {
  try {
    const container = await containerService.getContainer(id)
    const messages = await containerService.getMessages(id)
    return ok({ container, messages })
  } catch (e: any) { return err(e.message) }
})

server.registerTool('create_container', {
  description: 'Create a new container for an industry application.',
  inputSchema: {
    name: z.string().describe('Unique container name (e.g. "PCAOB Financial Audit")'),
    description: z.string().describe('Brief description of the industry domain').optional(),
  },
}, async ({ name, description }) => {
  try {
    const container = await containerService.createContainer({ name, description })
    return ok(container)
  } catch (e: any) { return err(e.message) }
})

server.registerTool('container_chat', {
  description: 'Send a message to a container\'s AI chat. The AI acts as an industry expert and generates entity type schemas. Returns the AI reply and updated container.',
  inputSchema: {
    container_id: z.string().describe('UUID of the container'),
    message: z.string().describe('Message to send to the AI'),
    provider: z.string().describe('LLM provider: ollama|openai|xai|gemini|mistral (default ollama)').optional(),
  },
}, async ({ container_id, message, provider }) => {
  try {
    const result = await containerService.chat(container_id, message, (provider as any) ?? 'ollama')
    return ok(result)
  } catch (e: any) { return err(e.message) }
})

server.registerTool('save_container_entity_types', {
  description: 'Save entity types to a container\'s manifest. Merges with existing by name.',
  inputSchema: {
    container_id: z.string().describe('UUID of the container'),
    entity_types: z.string().describe('JSON array of entity types: [{"name":"...", "description":"...", "schema":{...}, "key_fields":[...]}]'),
  },
}, async ({ container_id, entity_types }) => {
  try {
    const parsed = JSON.parse(entity_types)
    const container = await containerService.saveEntityTypes(container_id, parsed)
    return ok(container)
  } catch (e: any) { return err(e.message) }
})

server.registerTool('review_entity_types', {
  description: 'Mark entity types as reviewed in a container manifest.',
  inputSchema: {
    container_id: z.string().describe('UUID of the container'),
    names: z.string().describe('JSON array of entity type names to mark as reviewed: ["name1","name2"]'),
  },
}, async ({ container_id, names }) => {
  try {
    const parsed = JSON.parse(names)
    const container = await containerService.reviewEntityTypes(container_id, parsed)
    return ok(container)
  } catch (e: any) { return err(e.message) }
})

server.registerTool('lock_container', {
  description: 'Lock a container and deploy all reviewed entity types to the database. This creates actual entity_type rows. Cannot be undone.',
  inputSchema: {
    container_id: z.string().describe('UUID of the container to lock'),
  },
}, async ({ container_id }) => {
  try {
    const container = await containerService.lockContainer(container_id)
    return ok(container)
  } catch (e: any) { return err(e.message) }
})

// ─── Relation Tools ─────────────────────────────────────────

server.registerTool('link_entities', {
  description: 'Create a relation between two entities (e.g. parent, belongs_to, depends_on).',
  inputSchema: {
    source_entity_id: z.string().describe('UUID of the source entity'),
    target_entity_id: z.string().describe('UUID of the target entity'),
    relation_type: z.string().describe('Relation type (e.g. "parent", "belongs_to", "depends_on")'),
    metadata: z.string().describe('Optional JSON string of relation metadata').optional(),
  },
}, async ({ source_entity_id, target_entity_id, relation_type, metadata }) => {
  try {
    const parsedMeta = metadata ? JSON.parse(metadata) : undefined
    const relation = await relationService.linkEntities({
      source_entity_id, target_entity_id, relation_type, metadata: parsedMeta,
    })
    return ok(relation)
  } catch (e: any) { return err(e.message) }
})

server.registerTool('unlink_entities', {
  description: 'Remove a relation between two entities.',
  inputSchema: {
    source_entity_id: z.string().describe('UUID of the source entity'),
    target_entity_id: z.string().describe('UUID of the target entity'),
    relation_type: z.string().describe('Relation type to remove'),
  },
}, async ({ source_entity_id, target_entity_id, relation_type }) => {
  try {
    await relationService.unlinkEntities(source_entity_id, target_entity_id, relation_type)
    return ok({ unlinked: true })
  } catch (e: any) { return err(e.message) }
})

server.registerTool('get_entity_relations', {
  description: 'Get all relations for an entity. Returns source and target relations.',
  inputSchema: {
    entity_id: z.string().describe('UUID of the entity'),
    direction: z.string().describe('Filter direction: source|target|both (default both)').optional(),
  },
}, async ({ entity_id, direction }) => {
  try {
    const relations = await relationService.getEntityRelations(entity_id, (direction as any) ?? 'both')
    return ok(relations)
  } catch (e: any) { return err(e.message) }
})

// ─── Start ───────────────────────────────────────────────────

try {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[ai-ui] MCP server connected and ready')
  setInterval(() => {}, 1 << 30)
} catch (err) {
  console.error('[ai-ui] Failed to start:', err)
  process.exit(1)
}
