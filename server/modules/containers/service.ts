import * as repo from './repository'
import * as entityRepo from '../entities/repository'
import { transaction, query as dbQuery } from '../../db/index'
import type { Container, ContainerMessage, ContainerManifest } from '../../core/types/index'
import { getClient, getModel, type Provider } from '../../../src/api/providers'
import { buildPrompt, parseExplorationOutput } from '../exploration/prompts'
import { findDimensionByKey } from '../exploration/repository'

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

Your mission: help the admin build a **production-grade** industry application by defining a comprehensive container structure for LevelNine, a schema-driven UI platform.

## Your Expertise Mandate

When the admin names an industry or domain:
1. **Think exhaustively** — map out EVERY phase, sub-process, deliverable, and regulatory requirement. Do not give a surface-level overview. Go as deep as a practitioner would expect.
2. **Be specific** — use real terminology, real standard numbers (e.g., PCAOB AS 2201, GAAS AU-C 315), real form names (e.g., SEC Form S-1, 10-K), real workflow steps.
3. **Nothing left out** — if a practitioner would say "you forgot X", you failed. Include edge cases, exception handling workflows, and supporting deliverables.
4. **Group logically** — organize into phases that mirror how real practitioners actually work, not textbook categories.

## Completeness Checklist

Before finalizing your entity types, verify coverage across ALL of these axes. If any axis has zero entity types, you have a gap — fill it.

1. **Core workflow** — the primary business process, step by step (e.g., planning → execution → reporting → closure)
2. **Governance & compliance** — regulatory filings, standards, certifications, audits of the audit
3. **People & roles** — team assignments, approvals, supervision, rotation, independence, conflicts
4. **Documents & evidence** — workpapers, attachments, review trails, indexing, cross-references
5. **Testing & validation** — sampling methodology, analytical procedures, test results, extrapolation
6. **IT & systems** — IT general controls, application controls, SOC reports, data flows, cybersecurity
7. **Economics** — budgets, time tracking, billing, realization rates, fee arrangements
8. **External interfaces** — component/subsidiary work, third-party specialists, regulators, correspondences
9. **Reporting & communication** — committee reports, management letters, stakeholder filings, disclosures
10. **Quality control** — peer review, supervision, deficiency tracking, lessons learned, firm methodology

## What You Define

For the container, define:
1. **Entity types** (20-50+ depending on complexity) — the data models for this industry. Each needs:
   - \`name\` (snake_case, specific — e.g., \`going_concern_assessment\` not \`assessment\`)
   - \`description\` (one sentence, practitioner-level)
   - \`key_fields\` (the actual data fields a practitioner fills in)
2. **Schemas** — for each entity type, a JSON UI spec using LevelNine components
3. **Navigation** — phases and sections for the sidebar, mirroring real workflow order

## LevelNine Component Reference

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
- If you generated a full schema for an entity type in this response, add a "schema" key with the full LevelNine JSON spec
- The name must be snake_case with underscores
- This block is for machine consumption — keep it clean, no comments`

const SYSTEM_PROMPT = process.env.CONTAINER_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT

const COMPLETENESS_REVIEW_PROMPT = `Review your entity types against the Completeness Checklist in your system prompt. For each of the 10 axes, check if you have adequate coverage.

Identify gaps — axes with zero or weak coverage. Then ADD the missing entity types with name, description, and key_fields.

Do NOT repeat entity types you already defined. Only add NEW ones that fill gaps.

End with an updated \`\`\`json:entity_types block containing ALL entity types (original + new). This block must be cumulative.`

async function callWithEntityTypeRetry(
  client: any,
  modelId: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  let reply = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await client.chat.completions.create({
      model: modelId,
      messages,
      temperature: 0.7,
    })

    const content = response.choices[0]?.message?.content?.trim()
    if (!content) throw new ContainerError('Empty response from LLM', 502)

    if (attempt === 0) {
      reply = content
    } else {
      reply = reply + '\n\n' + content
    }
    if (reply.includes('```json:entity_types')) break

    messages.push({ role: 'assistant', content })
    messages.push({
      role: 'user',
      content: 'Your response is missing the required ```json:entity_types summary block. Re-read the system prompt instructions under "CRITICAL: Entity Type Summary Block" and append the block now. Return ONLY the ```json:entity_types block with all entity types as a JSON array.',
    })
  }
  return reply
}

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

  const { client } = getClient(provider)
  const modelId = getModel(provider, model)

  // Step 1: Call LLM with retry to enforce json:entity_types block
  let reply = await callWithEntityTypeRetry(client, modelId, messages)

  // Step 2: Auto self-review on first message (initial generation)
  // If this is the first user message, the LLM just proposed entity types — review for completeness
  const isFirstMessage = history.filter(m => m.role === 'user').length === 1
  if (isFirstMessage && reply.includes('```json:entity_types')) {
    messages.push({ role: 'assistant', content: reply })
    messages.push({
      role: 'user',
      content: COMPLETENESS_REVIEW_PROMPT,
    })

    const reviewReply = await callWithEntityTypeRetry(client, modelId, messages)
    // Save the initial response, then save the review as a second assistant message
    await repo.insertMessage({ container_id: containerId, role: 'assistant', content: reply })
    await repo.insertMessage({ container_id: containerId, role: 'assistant', content: reviewReply })
    return { reply: reply + '\n\n---\n\n## Completeness Review\n\n' + reviewReply, container }
  }

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
  onProgress?: (result: { name: string; success: boolean; error?: string; index: number; total: number; schema?: any }) => void,
  force: boolean = false,
): Promise<{ container: Container; results: Array<{ name: string; success: boolean; error?: string }> }> {
  const container = await repo.findContainerById(containerId)
  if (!container) throw new ContainerError('Container not found', 404)
  if (container.status === 'locked') throw new ContainerError('Cannot modify locked container', 403)

  const manifest = (container.manifest ?? {}) as ContainerManifest
  const targets = force
    ? (manifest.entity_types ?? [])
    : (manifest.entity_types ?? []).filter(et => !et.schema)

  if (targets.length === 0) {
    return { container, results: [] }
  }

  // Clear existing schemas when force-regenerating
  if (force) {
    for (const et of targets) {
      delete et.schema
      delete (et as any).data_schema
      delete (et as any).field_metadata
      delete (et as any).related_types
      delete (et as any).document_slots
      delete (et as any).report_relevance
    }
    await repo.updateContainer(containerId, { manifest })
  }

  const { client } = getClient(provider)
  const modelId = getModel(provider, model)

  // Build manifest context for type package generation
  const relations = manifest.relations ?? []
  const documents = manifest.documents ?? []
  const reports = manifest.reports ?? []

  // Type package prompt — asks for ui_spec + data_schema + field_metadata + related_types + document_slots + report_relevance
  const typePackagePrompt = `You are a veteran practitioner building a production-grade form for "{{name}}" ({{description}}).

Think like someone who uses this form DAILY. Include EVERY field a practitioner needs — not just the obvious ones. A real {{name}} form in production has 15-30+ fields organized into logical sections.

Seed fields (minimum, you MUST include these): {{key_fields}}
Container: "{{container_name}}"
{{manifest_context}}

Respond with ONLY a valid JSON object. Do NOT wrap in code fences or markdown.

EXAMPLE of correct output for entity type "invoice":
{
  "ui_spec": {
    "type": "Container",
    "props": { "title": "Invoice", "padding": "lg" },
    "children": [
      { "type": "Tabs", "props": { "tabs": ["Details", "Line Items", "Payment", "Notes"] }, "children": [
        { "type": "Stack", "props": { "gap": "md" }, "children": [
          { "type": "Card", "props": { "title": "Invoice Information" }, "children": [
            { "type": "Grid", "props": { "columns": 3, "gap": "md" }, "children": [
              { "type": "Input", "props": { "bind": "invoice_number", "label": "Invoice Number" } },
              { "type": "Select", "props": { "bind": "status", "label": "Status", "options": [{"value":"draft","label":"Draft"},{"value":"sent","label":"Sent"},{"value":"paid","label":"Paid"},{"value":"overdue","label":"Overdue"},{"value":"disputed","label":"Disputed"},{"value":"void","label":"Void"}] } },
              { "type": "Select", "props": { "bind": "invoice_type", "label": "Type", "options": [{"value":"standard","label":"Standard"},{"value":"recurring","label":"Recurring"},{"value":"credit_note","label":"Credit Note"},{"value":"proforma","label":"Proforma"}] } }
            ]},
            { "type": "Grid", "props": { "columns": 3, "gap": "md" }, "children": [
              { "type": "DatePicker", "props": { "bind": "issue_date", "label": "Issue Date" } },
              { "type": "DatePicker", "props": { "bind": "due_date", "label": "Due Date" } },
              { "type": "Input", "props": { "bind": "payment_terms", "label": "Payment Terms" } }
            ]}
          ]},
          { "type": "Card", "props": { "title": "Amounts" }, "children": [
            { "type": "Grid", "props": { "columns": 4, "gap": "md" }, "children": [
              { "type": "Input", "props": { "bind": "subtotal", "label": "Subtotal" } },
              { "type": "Input", "props": { "bind": "tax_amount", "label": "Tax" } },
              { "type": "Input", "props": { "bind": "discount_amount", "label": "Discount" } },
              { "type": "Input", "props": { "bind": "total_amount", "label": "Total" } }
            ]}
          ]}
        ]},
        { "type": "Table", "props": { "bind": "line_items", "columns": [{"key":"description","header":"Description"},{"key":"quantity","header":"Qty"},{"key":"unit_price","header":"Unit Price"},{"key":"amount","header":"Amount"}] } },
        { "type": "Stack", "props": { "gap": "md" }, "children": [
          { "type": "Grid", "props": { "columns": 2, "gap": "md" }, "children": [
            { "type": "Select", "props": { "bind": "payment_method", "label": "Payment Method", "options": [{"value":"bank_transfer","label":"Bank Transfer"},{"value":"check","label":"Check"},{"value":"credit_card","label":"Credit Card"}] } },
            { "type": "Input", "props": { "bind": "payment_reference", "label": "Payment Reference" } }
          ]},
          { "type": "DatePicker", "props": { "bind": "payment_date", "label": "Payment Date" } }
        ]},
        { "type": "Stack", "props": { "gap": "md" }, "children": [
          { "type": "Textarea", "props": { "bind": "internal_notes", "label": "Internal Notes" } },
          { "type": "FileUpload", "props": { "bind": "attachments", "label": "Supporting Documents" } }
        ]}
      ]}
    ]
  },
  "data_schema": {
    "type": "object",
    "properties": {
      "invoice_number": { "type": "string", "description": "Unique invoice identifier" },
      "status": { "type": "string", "enum": ["draft", "sent", "paid", "overdue", "disputed", "void"] },
      "invoice_type": { "type": "string", "enum": ["standard", "recurring", "credit_note", "proforma"] },
      "issue_date": { "type": "string", "format": "date" },
      "due_date": { "type": "string", "format": "date" },
      "payment_terms": { "type": "string" },
      "subtotal": { "type": "number" },
      "tax_amount": { "type": "number" },
      "discount_amount": { "type": "number" },
      "total_amount": { "type": "number" },
      "payment_method": { "type": "string", "enum": ["bank_transfer", "check", "credit_card"] },
      "payment_reference": { "type": "string" },
      "payment_date": { "type": "string", "format": "date" },
      "internal_notes": { "type": "string" },
      "attachments": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["invoice_number", "status", "issue_date", "due_date", "total_amount"]
  },
  "field_metadata": {
    "invoice_number": { "default": null, "searchable": true, "sortable": true, "show_in_list": true },
    "status": { "default": "draft", "searchable": true, "sortable": true, "show_in_list": true },
    "invoice_type": { "default": "standard", "searchable": true, "sortable": false, "show_in_list": false },
    "issue_date": { "default": null, "searchable": false, "sortable": true, "show_in_list": true },
    "due_date": { "default": null, "searchable": false, "sortable": true, "show_in_list": true },
    "payment_terms": { "default": "net_30", "searchable": false, "sortable": false, "show_in_list": false },
    "subtotal": { "default": 0, "searchable": false, "sortable": true, "show_in_list": false },
    "tax_amount": { "default": 0, "searchable": false, "sortable": false, "show_in_list": false },
    "discount_amount": { "default": 0, "searchable": false, "sortable": false, "show_in_list": false },
    "total_amount": { "default": 0, "searchable": false, "sortable": true, "show_in_list": true },
    "payment_method": { "default": null, "searchable": true, "sortable": false, "show_in_list": false },
    "payment_reference": { "default": null, "searchable": true, "sortable": false, "show_in_list": false },
    "payment_date": { "default": null, "searchable": false, "sortable": true, "show_in_list": false },
    "internal_notes": { "default": null, "searchable": true, "sortable": false, "show_in_list": false },
    "attachments": { "default": [], "searchable": false, "sortable": false, "show_in_list": false }
  },
  "related_types": [
    { "type": "client", "relation": "belongs_to", "display": "section" },
    { "type": "payment", "relation": "has_many", "display": "tab" }
  ],
  "document_slots": ["invoice_pdf"],
  "report_relevance": ["accounts_receivable_aging"]
}

NOW generate the type package for "{{name}}" following these STRICT RULES:

RULES:
- **ui_spec**: Use ONLY this node format: { "type": "ComponentName", "props": {...}, "children": [...] }. Do NOT use "components" key. Use "children" for nested content. Available components: Container, Tabs, Stack, Row, Grid, Card, Text, Heading, Select, DatePicker, FileUpload, Textarea, Table, Checkbox, Badge, Button, Input, Switch, Progress.
- **Field completeness**: The seed fields above are the MINIMUM. You MUST add every field a practitioner would need. Think: what would a 10-year veteran expect to fill in on this form? Include status fields, dates, approvals, references, notes, classifications, and attachments. Target 15-30 fields per entity type.
- **ui_spec structure**: Use Tabs to organize complex forms (3-5 tabs). Use Card within tabs to group related fields. Use Grid (columns: 2-3) for side-by-side fields. Every field needs a "bind" prop matching a data_schema property.
- **data_schema**: JSON Schema for THIS entity's OWN direct fields only. Use proper types (string, number, integer, boolean, array). Include "enum" with real industry values for constrained fields (e.g., status, type, rating, method). Do NOT include related entity types as array fields — those go in related_types.
- **field_metadata**: One entry per field in data_schema. Keys: default, searchable, sortable, show_in_list (all required). Mark 4-6 fields as show_in_list: true for the list view.
- **related_types**: Only include types from the manifest relations listed above. If no relations involve this type, return [].
- **document_slots**: Only include document names from the manifest documents listed above. If no documents reference this type, return []. Do NOT invent document names.
- **report_relevance**: Only include report names from the manifest reports listed above. If no reports reference this type, return [].`

  // Deterministic post-validation: fix bind mismatches and normalize component names
  function validateSchema(node: any, allowedBinds: Set<string>): { fixed: number; removed: number } {
    const stats = { fixed: 0, removed: 0 }

    // Normalize component type aliases
    const typeAliases: Record<string, string> = {
      NumberInput: 'Input', TextArea: 'Textarea', RichText: 'Textarea',
      Toggle: 'Switch', ProgressBar: 'Progress', Divider: 'Separator',
    }
    if (node.type && typeAliases[node.type]) {
      node.type = typeAliases[node.type]
      stats.fixed++
    }

    // Validate bind values
    if (node.props?.bind && typeof node.props.bind === 'string') {
      const bind = node.props.bind
      if (!allowedBinds.has(bind)) {
        // Try stripping _display suffix
        const stripped = bind.replace(/_display$/, '')
        if (allowedBinds.has(stripped)) {
          node.props.bind = stripped
          stats.fixed++
        }
        // Try removing dot notation (e.g. "disclosure_requirements.notes" → "disclosure_requirements")
        else if (bind.includes('.')) {
          const base = bind.split('.')[0]
          if (allowedBinds.has(base)) {
            node.props.bind = base
            stats.fixed++
          } else {
            delete node.props.bind
            stats.removed++
          }
        } else {
          // Unknown bind — remove it so the field doesn't silently lose data
          delete node.props.bind
          stats.removed++
        }
      }
    }

    // Recurse into children
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const childStats = validateSchema(child, allowedBinds)
        stats.fixed += childStats.fixed
        stats.removed += childStats.removed
      }
    }
    // Also recurse into tabs[].children (object format)
    if (Array.isArray(node.props?.tabs)) {
      for (const tab of node.props.tabs) {
        if (typeof tab === 'object' && Array.isArray(tab.children)) {
          for (const child of tab.children) {
            const childStats = validateSchema(child, allowedBinds)
            stats.fixed += childStats.fixed
            stats.removed += childStats.removed
          }
        }
      }
    }

    return stats
  }

  // Worker function for one entity type — returns full type package
  type TypePackageResult = {
    name: string
    success: boolean
    schema?: any
    data_schema?: any
    field_metadata?: any
    related_types?: any
    document_slots?: any
    report_relevance?: any
    error?: string
  }

  const generateOne = async (et: { name: string; description?: string; key_fields?: string[] }): Promise<TypePackageResult> => {
    try {
      // Build manifest context specific to this entity type
      const typeRelations = relations.filter(r => r.source_type === et.name || r.target_type === et.name)
      const typeDocs = documents.filter(d => d.entity_type === et.name)
      const typeReports = reports.filter(r => r.entity_types?.includes(et.name))

      let manifestContext = ''
      if (typeRelations.length > 0) {
        manifestContext += `\nRelations involving this type:\n${typeRelations.map(r => `- ${r.source_type} --[${r.relation_type}]--> ${r.target_type}: ${r.description ?? ''}`).join('\n')}`
      }
      if (typeDocs.length > 0) {
        manifestContext += `\nDocuments for this type:\n${typeDocs.map(d => `- ${d.name} (${d.format}): ${d.description}`).join('\n')}`
      }
      if (typeReports.length > 0) {
        manifestContext += `\nReports including this type:\n${typeReports.map(r => `- ${r.name} (${r.report_type}): ${r.description}`).join('\n')}`
      }

      const prompt = typePackagePrompt
        .replace(/\{\{name\}\}/g, et.name)
        .replace(/\{\{description\}\}/g, et.description ?? et.name)
        .replace(/\{\{key_fields\}\}/g, (et.key_fields ?? []).join(', ') || 'infer from domain')
        .replace(/\{\{container_name\}\}/g, container.name)
        .replace(/\{\{manifest_context\}\}/g, manifestContext || '\n(No relations, documents, or reports reference this type yet)')

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

      // Extract JSON from response — strip code fences, find first { to last }
      let jsonStr = reply
      const fenceMatch = reply.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim()
      }
      // Fallback: if still not valid JSON, extract from first { to last }
      if (!jsonStr.startsWith('{')) {
        const start = jsonStr.indexOf('{')
        const end = jsonStr.lastIndexOf('}')
        if (start !== -1 && end !== -1) {
          jsonStr = jsonStr.slice(start, end + 1)
        }
      }
      const pkg = JSON.parse(jsonStr)

      // Accept both type-package format and legacy ui_spec-only format
      const uiSpec = pkg.ui_spec ?? pkg

      // Validate binds against data_schema properties (the LLM's full field set), not just key_fields
      const dataSchemaFields = Object.keys(pkg.data_schema?.properties ?? {})
      const allowedBinds = new Set([...(et.key_fields ?? []), ...dataSchemaFields])

      // Deterministic post-validation
      if (allowedBinds.size > 0) {
        validateSchema(uiSpec, allowedBinds)
      }

      if (pkg.ui_spec) {
        return {
          name: et.name,
          success: true,
          schema: uiSpec,
          data_schema: pkg.data_schema ?? null,
          field_metadata: pkg.field_metadata ?? null,
          related_types: pkg.related_types ?? null,
          document_slots: pkg.document_slots ?? null,
          report_relevance: pkg.report_relevance ?? null,
        }
      }

      // Legacy fallback: entire response is the ui_spec
      return { name: et.name, success: true, schema: uiSpec }
    } catch (e: any) {
      return { name: et.name, success: false, error: e.message }
    }
  }

  // Run sequentially, saving each type package to DB immediately after generation
  const results: TypePackageResult[] = []
  const total = targets.length
  // Keep manifest in memory to avoid re-fetching from DB on each iteration
  const liveManifest = { ...(container.manifest ?? {}) } as ContainerManifest
  const etByName = new Map((liveManifest.entity_types ?? []).map(e => [e.name, e]))

  for (let i = 0; i < total; i++) {
    const result = await generateOne(targets[i])
    results.push(result)

    // Save to DB immediately so progress persists even if connection drops
    if (result.success && result.schema) {
      const et = etByName.get(result.name)
      if (et) {
        et.schema = result.schema
        if (result.data_schema) et.data_schema = result.data_schema
        if (result.field_metadata) et.field_metadata = result.field_metadata
        if (result.related_types) et.related_types = result.related_types
        if (result.document_slots) et.document_slots = result.document_slots
        if (result.report_relevance) et.report_relevance = result.report_relevance
        await repo.updateContainer(containerId, { manifest: liveManifest })
      }
    }

    onProgress?.({ name: result.name, success: result.success, error: result.error, index: i + 1, total, schema: result.schema })
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
        `INSERT INTO entity_types (name, description, schema, data_schema, field_metadata, related_types, document_slots, report_relevance, container_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (name, COALESCE(container_id, '00000000-0000-0000-0000-000000000000')) DO UPDATE SET
           description = EXCLUDED.description,
           schema = EXCLUDED.schema,
           data_schema = EXCLUDED.data_schema,
           field_metadata = EXCLUDED.field_metadata,
           related_types = EXCLUDED.related_types,
           document_slots = EXCLUDED.document_slots,
           report_relevance = EXCLUDED.report_relevance,
           updated_at = NOW()`,
        [
          et.name, et.description,
          et.schema ? JSON.stringify(et.schema) : null,
          et.data_schema ? JSON.stringify(et.data_schema) : null,
          et.field_metadata ? JSON.stringify(et.field_metadata) : null,
          et.related_types ? JSON.stringify(et.related_types) : null,
          et.document_slots ? JSON.stringify(et.document_slots) : null,
          et.report_relevance ? JSON.stringify(et.report_relevance) : null,
          id,
        ],
      )
    }

    // Upsert ALL manifest artifacts — catches chat-phase additions not yet materialized

    // Relations (skip malformed entries missing required fields)
    for (const rel of (manifest.relations ?? []).filter(r => r.source_type && r.target_type && r.relation_type)) {
      await client.query(
        `INSERT INTO cfg_relations (container_id, source_type, target_type, relation_type, description, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (container_id, source_type, target_type, relation_type) DO UPDATE SET
           description = EXCLUDED.description`,
        [id, rel.source_type, rel.target_type, rel.relation_type, rel.description ?? null, rel.source_dimension ?? null],
      )
    }

    // Roles
    for (const role of manifest.roles ?? []) {
      await client.query(
        `INSERT INTO cfg_roles (container_id, name, label, description, permissions, restricted_entity_types, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, description = EXCLUDED.description,
           permissions = EXCLUDED.permissions, restricted_entity_types = EXCLUDED.restricted_entity_types`,
        [id, role.name, role.label, role.description, JSON.stringify(role.permissions), JSON.stringify(role.restricted_entity_types), role.source_dimension ?? null],
      )
    }

    // Workflows (Step 5: ensures state machines are persisted for runtime enforcement)
    for (const wf of manifest.workflows ?? []) {
      await client.query(
        `INSERT INTO cfg_workflows (container_id, name, label, description, entity_type, statuses, transitions, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, description = EXCLUDED.description,
           entity_type = EXCLUDED.entity_type, statuses = EXCLUDED.statuses, transitions = EXCLUDED.transitions`,
        [id, wf.name, wf.label, wf.description, wf.entity_type, JSON.stringify(wf.statuses), JSON.stringify(wf.transitions), wf.source_dimension ?? null],
      )
    }

    // Compliance
    for (const c of manifest.compliance ?? []) {
      await client.query(
        `INSERT INTO cfg_compliance (container_id, name, standard, description, entity_types, checkpoints, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (container_id, name) DO UPDATE SET
           standard = EXCLUDED.standard, description = EXCLUDED.description,
           entity_types = EXCLUDED.entity_types, checkpoints = EXCLUDED.checkpoints`,
        [id, c.name, c.standard, c.description, JSON.stringify(c.entity_types), JSON.stringify(c.checkpoints), c.source_dimension ?? null],
      )
    }

    // Documents
    for (const d of manifest.documents ?? []) {
      await client.query(
        `INSERT INTO cfg_documents (container_id, name, label, description, entity_type, format, retention_days, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, description = EXCLUDED.description,
           entity_type = EXCLUDED.entity_type, format = EXCLUDED.format, retention_days = EXCLUDED.retention_days`,
        [id, d.name, d.label, d.description, d.entity_type ?? null, d.format, d.retention_days ?? null, d.source_dimension ?? null],
      )
    }

    // Integrations
    for (const i of manifest.integrations ?? []) {
      await client.query(
        `INSERT INTO cfg_integrations (container_id, name, label, description, system_type, direction, entity_types, config, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, description = EXCLUDED.description,
           system_type = EXCLUDED.system_type, direction = EXCLUDED.direction,
           entity_types = EXCLUDED.entity_types, config = EXCLUDED.config`,
        [id, i.name, i.label, i.description, i.system_type, i.direction, JSON.stringify(i.entity_types), JSON.stringify(i.config), i.source_dimension ?? null],
      )
    }

    // Reports
    for (const r of manifest.reports ?? []) {
      await client.query(
        `INSERT INTO cfg_reports (container_id, name, label, description, report_type, entity_types, schema, schedule, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, description = EXCLUDED.description,
           report_type = EXCLUDED.report_type, entity_types = EXCLUDED.entity_types,
           schema = EXCLUDED.schema, schedule = EXCLUDED.schedule`,
        [id, r.name, r.label, r.description, r.report_type, JSON.stringify(r.entity_types), r.schema ? JSON.stringify(r.schema) : null, r.schedule ?? null, r.source_dimension ?? null],
      )
    }

    // Edge cases
    for (const e of manifest.edge_cases ?? []) {
      await client.query(
        `INSERT INTO cfg_edge_cases (container_id, name, label, description, category, entity_types, handling, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, description = EXCLUDED.description,
           category = EXCLUDED.category, entity_types = EXCLUDED.entity_types, handling = EXCLUDED.handling`,
        [id, e.name, e.label, e.description, e.category, JSON.stringify(e.entity_types), e.handling, e.source_dimension ?? null],
      )
    }

    // Notifications
    for (const n of manifest.notifications ?? []) {
      await client.query(
        `INSERT INTO cfg_notifications (container_id, name, label, description, trigger_entity_type, trigger_event, trigger_condition, recipients, channel, escalation_minutes, escalation_to, template, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, description = EXCLUDED.description,
           trigger_entity_type = EXCLUDED.trigger_entity_type, trigger_event = EXCLUDED.trigger_event,
           trigger_condition = EXCLUDED.trigger_condition, recipients = EXCLUDED.recipients,
           channel = EXCLUDED.channel, escalation_minutes = EXCLUDED.escalation_minutes,
           escalation_to = EXCLUDED.escalation_to, template = EXCLUDED.template`,
        [id, n.name, n.label, n.description, n.trigger_entity_type, n.trigger_event,
         n.trigger_condition ?? null, JSON.stringify(n.recipients), n.channel,
         n.escalation_minutes ?? null, n.escalation_to ?? null, n.template ?? null, n.source_dimension ?? null],
      )
    }

    // UI configs
    for (const u of manifest.ui_configs ?? []) {
      await client.query(
        `INSERT INTO cfg_ui_configs (container_id, name, label, entity_type, view_type, grid_config, detail_config, navigation, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, entity_type = EXCLUDED.entity_type,
           view_type = EXCLUDED.view_type, grid_config = EXCLUDED.grid_config,
           detail_config = EXCLUDED.detail_config, navigation = EXCLUDED.navigation`,
        [id, u.name, u.label, u.entity_type, u.view_type,
         JSON.stringify(u.grid_config), JSON.stringify(u.detail_config ?? {}),
         JSON.stringify(u.navigation ?? {}), u.source_dimension ?? null],
      )
    }

    // Pages (D11)
    for (const p of manifest.pages ?? []) {
      await client.query(
        `INSERT INTO cfg_pages (container_id, name, label, route, icon, layout, sections, is_default, access_roles, sort_order, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, route = EXCLUDED.route, icon = EXCLUDED.icon,
           layout = EXCLUDED.layout, sections = EXCLUDED.sections,
           is_default = EXCLUDED.is_default, access_roles = EXCLUDED.access_roles,
           sort_order = EXCLUDED.sort_order`,
        [id, p.name, p.label, p.route, p.icon ?? null, p.layout,
         JSON.stringify(p.sections), p.is_default ?? false,
         p.access_roles ? JSON.stringify(p.access_roles) : null,
         p.is_default ? 0 : 99, p.source_dimension ?? null],
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

  // Insert seed data if present in manifest
  const manifest = container.manifest as ContainerManifest
  if (manifest.seed_data?.length) {
    await transaction(async (client) => {
      for (const seed of manifest.seed_data!) {
        // Look up entity_type_id by name + container_id
        const typeResult = await client.query(
          'SELECT id FROM entity_types WHERE name = $1 AND container_id = $2',
          [seed.entity_type, id],
        )
        if (typeResult.rows.length === 0) continue

        const entityTypeId = typeResult.rows[0].id
        for (const record of seed.records) {
          await client.query(
            `INSERT INTO entities (entity_type_id, container_id, name, status, content, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT DO NOTHING`,
            [entityTypeId, id, record.name, record.status || 'active',
             JSON.stringify(record.content), JSON.stringify({ source: 'seed_data' })],
          )
        }
      }
    })
  }

  const c = await repo.updateContainer(id, { status: 'launched', slug } as any)
  if (!c) throw new ContainerError('Failed to launch container', 500)
  return c
}

// ============================================================================
// Generate Pages & Seed Data (D11 for launched containers)
// ============================================================================

export async function generatePagesAndSeed(
  containerId: string,
  provider: Provider = 'ollama',
  model?: string,
): Promise<{ pages: any[]; seedCount: number }> {
  const container = await repo.findContainerById(containerId)
  if (!container) throw new ContainerError('Container not found', 404)

  const manifest = (container.manifest ?? {}) as ContainerManifest
  if (!manifest.entity_types?.length) {
    throw new ContainerError('Container has no entity types — cannot generate pages', 400)
  }

  // Get D11 dimension config
  const dimension = await findDimensionByKey('pages_dashboard')
  if (!dimension) throw new ContainerError('D11 (pages_dashboard) dimension not found — run seed migration', 500)

  // Fetch user's original prompt for domain context
  const promptResult = await dbQuery<{ content: string }>(
    `SELECT content FROM chat_messages WHERE container_id = $1 AND role = 'user' ORDER BY created_at ASC LIMIT 1`,
    [containerId],
  )
  const userPrompt = promptResult.rows[0]?.content ?? container.name

  // Build D11 prompt
  const prompt = buildPrompt('generate', dimension, container.name, manifest, { userPrompt })

  const { client } = getClient(provider)
  const modelId = getModel(provider, model)

  // Call LLM with retry for missing json:exploration_output block
  let fullOutput = ''
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: `You are an expert UI/UX designer building dashboard pages and seed data for the "${container.name}" application. The user specifically requested: "${userPrompt}". Design pages that give practitioners an immediate, data-rich experience with real metrics and workflows.`,
    },
    { role: 'user', content: prompt },
  ]

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await client.chat.completions.create({
      model: modelId,
      messages,
      temperature: 0.7,
    })

    const content = response.choices[0]?.message?.content?.trim()
    if (!content) throw new ContainerError('Empty LLM response', 502)

    fullOutput = attempt === 0 ? content : fullOutput + '\n\n' + content
    if (fullOutput.includes('```json:exploration_output')) break

    messages.push({ role: 'assistant', content })
    messages.push({
      role: 'user',
      content: 'Your response is missing the required ```json:exploration_output block. Please include it now with pages_added and seed_data arrays.',
    })
  }

  // Parse output
  const parsed = parseExplorationOutput(fullOutput)
  if (!parsed) throw new ContainerError('Failed to parse LLM output — no json:exploration_output block found', 502)

  const pagesAdded = parsed.pages_added ?? []
  const seedData = parsed.seed_data ?? []

  if (pagesAdded.length === 0) {
    throw new ContainerError('LLM returned no pages — try again', 502)
  }

  // Transaction: upsert pages + insert seed data
  let seedCount = 0
  await transaction(async (client) => {
    // Upsert pages into cfg_pages
    for (let i = 0; i < pagesAdded.length; i++) {
      const p = pagesAdded[i]
      await client.query(
        `INSERT INTO cfg_pages (container_id, name, label, route, icon, layout, sections, is_default, access_roles, sort_order, source_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (container_id, name) DO UPDATE SET
           label = EXCLUDED.label, route = EXCLUDED.route, icon = EXCLUDED.icon,
           layout = EXCLUDED.layout, sections = EXCLUDED.sections,
           is_default = EXCLUDED.is_default, access_roles = EXCLUDED.access_roles,
           sort_order = EXCLUDED.sort_order`,
        [
          containerId, p.name, p.label, p.route, p.icon ?? null,
          p.layout ?? 'grid', JSON.stringify(p.sections ?? []),
          p.is_default ?? false, p.access_roles ? JSON.stringify(p.access_roles) : null,
          p.is_default ? 0 : (i + 1) * 10, 'pages_dashboard',
        ],
      )
    }

    // Insert seed data (skip if container already has seeded records)
    const existingSeed = await client.query(
      `SELECT count(*) as cnt FROM entities WHERE container_id = $1 AND metadata->>'source' = 'seed_data'`,
      [containerId],
    )
    if (parseInt(existingSeed.rows[0].cnt) === 0 && seedData.length > 0) {
      for (const seed of seedData) {
        const typeResult = await client.query(
          'SELECT id FROM entity_types WHERE name = $1 AND container_id = $2',
          [seed.entity_type, containerId],
        )
        if (typeResult.rows.length === 0) continue

        const entityTypeId = typeResult.rows[0].id
        for (const record of seed.records) {
          await client.query(
            `INSERT INTO entities (entity_type_id, container_id, name, status, content, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT DO NOTHING`,
            [entityTypeId, containerId, record.name, record.status || 'active',
             JSON.stringify(record.content), JSON.stringify({ source: 'seed_data' })],
          )
          seedCount++
        }
      }
    }
  })

  // Merge pages + seed_data into manifest
  const updatedManifest = { ...manifest }
  updatedManifest.pages = pagesAdded.map((p: any) => ({ ...p, source_dimension: 'pages_dashboard' }))
  if (seedData.length > 0) {
    updatedManifest.seed_data = [...(updatedManifest.seed_data ?? []), ...seedData]
  }
  await repo.updateContainer(containerId, { manifest: updatedManifest })

  return { pages: pagesAdded, seedCount }
}

// ============================================================================
// Manifest operations — save, review, lock entity types
// ============================================================================

/** Save entity types to manifest (merge with existing, overwrite by name) */
export async function saveEntityTypes(
  containerId: string,
  entityTypes: Array<{
    name: string; description: string; schema: Record<string, any> | null; key_fields?: string[]
    data_schema?: Record<string, any> | null; field_metadata?: Record<string, any> | null
    related_types?: Array<{ type: string; relation: string; display: string }> | null
    document_slots?: string[] | null; report_relevance?: string[] | null
  }>,
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
