import * as repo from './repository'
import * as entityRepo from '../entities/repository'
import { transaction } from '../../db/index'
import type { Container, ContainerMessage, ContainerManifest } from '../../core/types/index'
import { getClient, getModel, type Provider } from '../../../src/api/providers'

export class ContainerError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'ContainerError'
  }
}

// ============================================================================
// Container CRUD
// ============================================================================

export async function listContainers(): Promise<Container[]> {
  return repo.findAllContainers()
}

export async function getContainer(id: string): Promise<Container> {
  const c = await repo.findContainerById(id)
  if (!c) throw new ContainerError('Container not found', 404)
  return c
}

export async function getContainerBySlug(slug: string): Promise<Container> {
  const c = await repo.findContainerBySlug(slug)
  if (!c) throw new ContainerError('App not found', 404)
  return c
}

export async function createContainer(data: {
  name: string
  description?: string
  created_by_user_id?: string
}): Promise<Container> {
  if (!data.name?.trim()) throw new ContainerError('Name is required', 400)
  return repo.insertContainer(data)
}

export async function updateContainer(
  id: string,
  data: { name?: string; description?: string; status?: string; manifest?: ContainerManifest },
): Promise<Container> {
  const existing = await repo.findContainerById(id)
  if (!existing) throw new ContainerError('Container not found', 404)
  if (existing.status === 'locked' && data.status !== 'draft') {
    throw new ContainerError('Locked containers cannot be modified. Create a new version.', 403)
  }
  const c = await repo.updateContainer(id, data as any)
  if (!c) throw new ContainerError('Container not found', 404)
  return c
}

export async function deleteContainer(id: string): Promise<void> {
  const existing = await repo.findContainerById(id)
  if (!existing) throw new ContainerError('Container not found', 404)
  if (existing.status === 'locked') throw new ContainerError('Cannot delete locked container', 403)
  await repo.deleteContainer(id)
}

// ============================================================================
// Chat
// ============================================================================

export async function getMessages(containerId: string): Promise<ContainerMessage[]> {
  return repo.findMessagesByContainer(containerId)
}

const DEFAULT_SYSTEM_PROMPT = `You are the world's foremost expert in whatever industry the admin describes. You have decades of hands-on experience, know every regulation, standard, workflow, edge case, and best practice inside out. You think like a veteran practitioner who has seen it all — not a generalist summarizing Wikipedia.

Your mission: help the admin build a **production-grade** industry application by defining a comprehensive container structure for ai-ui, a schema-driven UI platform.

## Your Expertise Mandate

When the admin names an industry or domain:
1. **Think exhaustively** — map out EVERY phase, sub-process, deliverable, and regulatory requirement. Do not give a surface-level overview. Go as deep as a practitioner would expect.
2. **Be specific** — use real terminology, real standard numbers (e.g., PCAOB AS 2201, GAAS AU-C 315), real form names (e.g., SEC Form S-1, 10-K), real workflow steps.
3. **Nothing left out** — if a practitioner would say "you forgot X", you failed. Include edge cases, exception handling workflows, and supporting deliverables.
4. **Group logically** — organize into phases that mirror how real practitioners actually work, not textbook categories.

## What You Define

For the container, define:
1. **Entity types** (20-50+ depending on complexity) — the data models for this industry. Each needs:
   - \`name\` (snake_case, specific — e.g., \`going_concern_assessment\` not \`assessment\`)
   - \`description\` (one sentence, practitioner-level)
   - \`key_fields\` (the actual data fields a practitioner fills in)
2. **Schemas** — for each entity type, a JSON UI spec using ai-ui components
3. **Navigation** — phases and sections for the sidebar, mirroring real workflow order

## ai-ui Component Reference

Available components (use the right one for each field type):
- **Container** — wrapper with padding (sm/md/lg)
- **Heading** — level 1-6, text
- **Text** — body text, descriptions, instructions
- **Input** — text/number/email/password fields with label, placeholder, bind
- **Select** — dropdown with label, options [{value, label}], bind
- **Checkbox** — single checkbox with label, bind (boolean)
- **Toggle** — on/off switch with label, bind
- **DatePicker** — date selection with label, bind
- **FileUpload** — file attachment with label, accept, bind
- **RichText** — multi-line formatted text editor with label, bind
- **Table** — data table with columns [{key, header}], bind
- **Card** — grouped section with title
- **Tabs** — tabbed sections with tabs [{label, children}]
- **Accordion** — collapsible sections with items [{title, children}]
- **Grid** — responsive grid layout with columns count, children
- **Stat** — key metric display with label, value, change
- **Badge** — status indicator with text, variant
- **Alert** — info/warning/error/success message with title, message, variant
- **ProgressBar** — completion tracker with value, max, label
- **Chart** — bar/line/doughnut/pie with chartType, data, options
- **Timeline** — chronological events with items [{title, description, date}]
- **Divider** — horizontal separator
- **Spacer** — vertical spacing (sm/md/lg)
- **Button** — action button with label, variant, action
- **KanbanBoard** — drag-and-drop board with columns, items
- **Breadcrumb** — navigation path
- **Rating** — star rating with bind

## Schema Format

\`\`\`json
{
  "type": "Container",
  "props": { "padding": "lg" },
  "children": [
    { "type": "Heading", "props": { "level": 2, "text": "Section Title" } },
    { "type": "Input", "props": { "label": "Field Name", "placeholder": "...", "bind": "field_name" } },
    { "type": "Select", "props": { "label": "Status", "options": [{"value": "draft", "label": "Draft"}], "bind": "status" } },
    { "type": "DatePicker", "props": { "label": "Due Date", "bind": "due_date" } },
    { "type": "RichText", "props": { "label": "Notes", "bind": "notes" } },
    { "type": "FileUpload", "props": { "label": "Supporting Document", "bind": "attachment" } }
  ]
}
\`\`\`

Use "bind" props to connect form fields to entity content keys. Use Tabs and Accordion for complex forms with many sections. Use Grid for side-by-side fields. Use Card to visually group related fields.

## Response Style

- Be conversational but dense with information
- Use markdown for structure (headers, lists, tables)
- Wrap JSON schemas in \`\`\`json code blocks
- When proposing the initial structure, list ALL entity types with descriptions — don't hold back
- When the admin asks to detail a specific entity type, generate its FULL schema with every field a practitioner would need

## CRITICAL: Entity Type Summary Block

At the END of EVERY response that defines or modifies entity types, you MUST include a machine-readable summary block wrapped in \`\`\`json:entity_types markers. This is how the system saves your work. The block must contain ALL entity types discussed so far (cumulative, not just new ones).

Format:
\`\`\`json:entity_types
[
  {
    "name": "snake_case_name",
    "description": "One-sentence practitioner-level description",
    "key_fields": ["field_a", "field_b", "field_c"]
  }
]
\`\`\`

Rules for this block:
- Include it at the very end of your response, after all discussion
- It must be valid JSON — an array of objects
- Include ALL entity types from the conversation so far, not just newly mentioned ones
- If you generated a full schema for an entity type in this response, add a "schema" key with the full ai-ui JSON spec
- The name must be snake_case with underscores
- This block is for machine consumption — keep it clean, no comments`

const SYSTEM_PROMPT = process.env.CONTAINER_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT

export async function chat(
  containerId: string,
  userMessage: string,
  provider: Provider = 'ollama',
  model?: string,
): Promise<{ reply: string; container: Container }> {
  const container = await repo.findContainerById(containerId)
  if (!container) throw new ContainerError('Container not found', 404)
  if (container.status === 'locked') throw new ContainerError('Cannot chat on locked container', 403)

  // Save user message
  await repo.insertMessage({ container_id: containerId, role: 'user', content: userMessage })

  // Build message history
  const history = await repo.findMessagesByContainer(containerId)
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: `Current container: "${container.name}" (${container.status})\nCurrent manifest: ${JSON.stringify(container.manifest)}` },
  ]

  for (const msg of history) {
    if (msg.role === 'system') continue
    messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content })
  }

  // Call LLM
  const { client } = getClient(provider)
  const modelId = getModel(provider, model)

  const response = await client.chat.completions.create({
    model: modelId,
    messages,
    temperature: 0.7,
  })

  const reply = response.choices[0]?.message?.content?.trim()
  if (!reply) throw new ContainerError('Empty response from LLM', 502)

  // Save assistant reply
  await repo.insertMessage({ container_id: containerId, role: 'assistant', content: reply })

  return { reply, container }
}

// ============================================================================
// Parallel Schema Generation
// ============================================================================

/** Generate schemas for all missing entity types in parallel */
export async function generateAllSchemas(
  containerId: string,
  provider: Provider = 'ollama',
  model?: string,
  concurrency: number = 5,
  onProgress?: (result: { name: string; success: boolean; error?: string; index: number; total: number }) => void,
): Promise<{ container: Container; results: Array<{ name: string; success: boolean; error?: string }> }> {
  const container = await repo.findContainerById(containerId)
  if (!container) throw new ContainerError('Container not found', 404)
  if (container.status === 'locked') throw new ContainerError('Cannot modify locked container', 403)

  const manifest = (container.manifest ?? {}) as ContainerManifest
  const missing = (manifest.entity_types ?? []).filter(et => !et.schema)

  if (missing.length === 0) {
    return { container, results: [] }
  }

  const { client } = getClient(provider)
  const modelId = getModel(provider, model)

  // Build a focused prompt for single entity type schema generation
  const schemaPrompt = process.env.PARALLEL_SCHEMA_PROMPT ?? `Generate the full detailed JSON schema for "{{name}}" ({{description}}).

Use appropriate ai-ui components (Tabs for sections, Select for dropdowns, DatePicker for dates, FileUpload for documents, RichText for notes, Table for tabular data, Checkbox for booleans, Grid for side-by-side fields, Card for grouped sections).

Key fields to include: {{key_fields}}

Respond with ONLY a valid JSON object — no markdown, no explanation, no code fences. The JSON should be an ai-ui spec starting with {"type": "Container", ...}.`

  // Worker function for one entity type
  const generateOne = async (et: { name: string; description?: string; key_fields?: string[] }): Promise<{ name: string; success: boolean; schema?: any; error?: string }> => {
    try {
      const prompt = schemaPrompt
        .replace(/\{\{name\}\}/g, et.name)
        .replace(/\{\{description\}\}/g, et.description ?? et.name)
        .replace(/\{\{key_fields\}\}/g, (et.key_fields ?? []).join(', ') || 'infer from domain')

      const response = await client.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      })

      const reply = response.choices[0]?.message?.content?.trim()
      if (!reply) return { name: et.name, success: false, error: 'Empty LLM response' }

      // Extract JSON from response (handle optional code fences)
      const jsonMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, reply]
      const jsonStr = jsonMatch[1]!.trim()
      const schema = JSON.parse(jsonStr)

      return { name: et.name, success: true, schema }
    } catch (e: any) {
      return { name: et.name, success: false, error: e.message }
    }
  }

  // Run sequentially, saving each schema to DB immediately after generation
  const results: Array<{ name: string; success: boolean; schema?: any; error?: string }> = []
  const total = missing.length

  for (let i = 0; i < total; i++) {
    const result = await generateOne(missing[i])
    results.push(result)

    // Save to DB immediately so progress persists even if connection drops
    if (result.success && result.schema) {
      const fresh = await repo.findContainerById(containerId)
      if (fresh) {
        const m = (fresh.manifest ?? {}) as ContainerManifest
        const et = (m.entity_types ?? []).find(e => e.name === result.name)
        if (et) {
          et.schema = result.schema
          await repo.updateContainer(containerId, { manifest: m })
        }
      }
    }

    onProgress?.({ name: result.name, success: result.success, error: result.error, index: i + 1, total })
  }

  // Log a summary message to chat history
  const successful = results.filter(r => r.success && r.schema)
  const summary = results.map(r => r.success ? `✓ ${r.name}` : `✗ ${r.name}: ${r.error}`).join('\n')
  await repo.insertMessage({
    container_id: containerId,
    role: 'assistant',
    content: `**Schema generation complete** (${successful.length}/${results.length} succeeded)\n\n${summary}`,
  })

  const updated = await repo.findContainerById(containerId)
  return { container: updated!, results: results.map(r => ({ name: r.name, success: r.success, error: r.error })) }
}


// ============================================================================
// Lock
// ============================================================================

export async function lockContainer(id: string): Promise<Container> {
  const container = await repo.findContainerById(id)
  if (!container) throw new ContainerError('Container not found', 404)

  const manifest = container.manifest as ContainerManifest
  if (!manifest.entity_types?.length) {
    throw new ContainerError('Container has no entity types defined', 400)
  }

  const unreviewed = manifest.entity_types.filter(et => !et.reviewed)
  if (unreviewed.length > 0) {
    throw new ContainerError(
      `${unreviewed.length} entity type(s) not yet reviewed: ${unreviewed.map(e => e.name).join(', ')}`,
      400,
    )
  }

  // Upsert any entity types not yet materialized (e.g. from chat phase or
  // entity types added across multiple dimensions). Uses ON CONFLICT so
  // rows already created at gate-approval time are simply updated.
  const result = await transaction(async (client) => {
    for (const et of manifest.entity_types!) {
      await client.query(
        `INSERT INTO entity_types (name, description, schema, container_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (name, COALESCE(container_id, '00000000-0000-0000-0000-000000000000')) DO UPDATE SET
           description = EXCLUDED.description,
           schema = EXCLUDED.schema,
           updated_at = NOW()`,
        [et.name, et.description, et.schema ? JSON.stringify(et.schema) : null, id],
      )
    }

    // Upsert any remaining relations not yet materialized
    for (const rel of manifest.relations ?? []) {
      await client.query(
        `INSERT INTO container_relations (container_id, source_type, target_type, relation_type, description, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (container_id, source_type, target_type, relation_type) DO UPDATE SET
           description = EXCLUDED.description`,
        [id, rel.source_type, rel.target_type, rel.relation_type, rel.description ?? null, rel.source_dimension ?? null],
      )
    }

    // Lock the container
    const res = await client.query(
      `UPDATE containers SET status = 'locked' WHERE id = $1 RETURNING *`,
      [id],
    )
    return res.rows[0] as Container
  })

  return result
}

// ============================================================================
// Launch — make a locked container into a live app
// ============================================================================

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function launchContainer(id: string): Promise<Container> {
  const container = await repo.findContainerById(id)
  if (!container) throw new ContainerError('Container not found', 404)
  if (container.status !== 'locked') throw new ContainerError('Container must be locked before launching', 400)

  const slug = slugify(container.name)

  // Check slug uniqueness
  const existing = await repo.findContainerBySlug(slug)
  if (existing && existing.id !== id) {
    throw new ContainerError(`Slug "${slug}" is already taken by another container`, 409)
  }

  const c = await repo.updateContainer(id, { status: 'launched', slug } as any)
  if (!c) throw new ContainerError('Failed to launch container', 500)
  return c
}

// ============================================================================
// Manifest operations — save, review, lock entity types
// ============================================================================

/** Save entity types to manifest (merge with existing, overwrite by name) */
export async function saveEntityTypes(
  containerId: string,
  entityTypes: Array<{ name: string; description: string; schema: Record<string, any> | null; key_fields?: string[] }>,
): Promise<Container> {
  const container = await repo.findContainerById(containerId)
  if (!container) throw new ContainerError('Container not found', 404)
  if (container.status === 'locked') throw new ContainerError('Cannot modify locked container', 403)

  const manifest = (container.manifest ?? {}) as ContainerManifest
  const existing = manifest.entity_types ?? []

  // Merge: update existing by name, add new ones
  for (const incoming of entityTypes) {
    const idx = existing.findIndex(e => e.name === incoming.name)
    if (idx >= 0) {
      // Don't overwrite if already reviewed — must unlock first
      if (existing[idx].reviewed) {
        throw new ContainerError(`Entity type "${incoming.name}" is reviewed and cannot be modified. Unlock it first.`, 403)
      }
      existing[idx] = { ...existing[idx], ...incoming }
    } else {
      existing.push({ ...incoming, reviewed: false })
    }
  }

  manifest.entity_types = existing
  const c = await repo.updateContainer(containerId, { manifest })
  if (!c) throw new ContainerError('Failed to update manifest', 500)
  return c
}

/** Save navigation to manifest */
export async function saveNavigation(
  containerId: string,
  navigation: Array<{ label: string; children: string[] }>,
): Promise<Container> {
  const container = await repo.findContainerById(containerId)
  if (!container) throw new ContainerError('Container not found', 404)
  if (container.status === 'locked') throw new ContainerError('Cannot modify locked container', 403)

  const manifest = (container.manifest ?? {}) as ContainerManifest
  manifest.navigation = navigation
  const c = await repo.updateContainer(containerId, { manifest })
  if (!c) throw new ContainerError('Failed to update manifest', 500)
  return c
}

/** Mark specific entity types as reviewed (selective lock) */
export async function reviewEntityTypes(
  containerId: string,
  names: string[],
): Promise<Container> {
  const container = await repo.findContainerById(containerId)
  if (!container) throw new ContainerError('Container not found', 404)
  if (container.status === 'locked') throw new ContainerError('Cannot modify locked container', 403)

  const manifest = (container.manifest ?? {}) as ContainerManifest
  const existing = manifest.entity_types ?? []

  for (const name of names) {
    const et = existing.find(e => e.name === name)
    if (!et) throw new ContainerError(`Entity type "${name}" not found in manifest`, 404)
    if (!et.schema) throw new ContainerError(`Entity type "${name}" has no schema — generate one before reviewing`, 400)
    et.reviewed = true
  }

  manifest.entity_types = existing
  const c = await repo.updateContainer(containerId, { manifest })
  if (!c) throw new ContainerError('Failed to update manifest', 500)
  return c
}

/** Unlock a reviewed entity type for further editing */
export async function unlockEntityType(
  containerId: string,
  name: string,
): Promise<Container> {
  const container = await repo.findContainerById(containerId)
  if (!container) throw new ContainerError('Container not found', 404)
  if (container.status === 'locked') throw new ContainerError('Cannot modify locked container', 403)

  const manifest = (container.manifest ?? {}) as ContainerManifest
  const et = (manifest.entity_types ?? []).find(e => e.name === name)
  if (!et) throw new ContainerError(`Entity type "${name}" not found in manifest`, 404)
  et.reviewed = false

  const c = await repo.updateContainer(containerId, { manifest })
  if (!c) throw new ContainerError('Failed to update manifest', 500)
  return c
}

/** Remove entity types from manifest */
export async function removeEntityTypes(
  containerId: string,
  names: string[],
): Promise<Container> {
  const container = await repo.findContainerById(containerId)
  if (!container) throw new ContainerError('Container not found', 404)
  if (container.status === 'locked') throw new ContainerError('Cannot modify locked container', 403)

  const manifest = (container.manifest ?? {}) as ContainerManifest
  const existing = manifest.entity_types ?? []

  for (const name of names) {
    const et = existing.find(e => e.name === name)
    if (et?.reviewed) throw new ContainerError(`Entity type "${name}" is reviewed — unlock it before removing`, 403)
  }

  manifest.entity_types = existing.filter(e => !names.includes(e.name))
  const c = await repo.updateContainer(containerId, { manifest })
  if (!c) throw new ContainerError('Failed to update manifest', 500)
  return c
}
