/**
 * App Assistant — System Prompt Builder
 *
 * Constructs context-aware system prompts by extracting relevant sections
 * from the container manifest based on the current page context.
 */

import type { Container, EntityType } from '../../core/types/index'
import { query } from '../../db/index'

interface PageContext {
  page: 'dashboard' | 'list' | 'detail' | 'new'
  entityType?: string
  entityId?: string
  entityStatus?: string
}

/**
 * Build the system prompt for the AI assistant based on the current page context.
 * Extracts relevant manifest sections so the AI has domain knowledge without
 * receiving the entire manifest on every request.
 */
export async function buildAssistantSystemPrompt(
  container: Container,
  pageContext: PageContext,
  entityTypes: EntityType[],
  userRole?: string,
): Promise<string> {
  const manifest = container.manifest ?? {}
  const parts: string[] = []

  // Base identity
  parts.push(`You are an AI assistant for "${container.name}", a ${container.industry ?? 'business'} application on the LevelNine platform.`)
  parts.push(`You help users create records, fill forms, navigate workflows, understand compliance requirements, and get work done efficiently.`)
  parts.push('')

  // User context
  if (userRole) {
    parts.push(`## Current User`)
    parts.push(`Role: ${userRole}`)
    const role = (manifest.roles ?? []).find((r: any) => r.name === userRole)
    if (role) {
      parts.push(`Description: ${role.description ?? 'N/A'}`)
      if (role.permissions?.length) parts.push(`Permissions: ${role.permissions.join(', ')}`)
    }
    parts.push('')
  }

  // Entity types overview (always useful)
  parts.push(`## Entity Types in This Application`)
  const typeNames = entityTypes.map(et => et.name)
  parts.push(`Available types (${typeNames.length}): ${typeNames.join(', ')}`)
  parts.push('')

  // Page-specific context
  if (pageContext.page === 'dashboard') {
    parts.push(buildDashboardContext(manifest))
  } else if (pageContext.page === 'list' && pageContext.entityType) {
    parts.push(await buildListContext(container.id, pageContext.entityType, entityTypes, manifest))
  } else if ((pageContext.page === 'detail' || pageContext.page === 'new') && pageContext.entityType) {
    parts.push(await buildDetailContext(container.id, pageContext, entityTypes, manifest))
  }

  // Workflows relevant to current context
  const workflows = await getWorkflows(container.id, pageContext.entityType)
  if (workflows.length > 0) {
    parts.push(`## Workflows`)
    for (const wf of workflows) {
      parts.push(`### ${wf.label ?? wf.name} (for ${wf.entity_type})`)
      parts.push(`Statuses: ${(wf.statuses ?? []).join(' → ')}`)
      if (wf.transitions?.length) {
        parts.push(`Transitions:`)
        for (const t of wf.transitions) {
          const roleGate = t.role ? ` [requires: ${t.role}]` : ''
          const cond = t.conditions ? ` (when: ${t.conditions})` : ''
          parts.push(`  - ${t.from} → ${t.to}${roleGate}${cond}`)
        }
      }
    }
    parts.push('')
  }

  // Compliance rules
  const compliance = await getCompliance(container.id, pageContext.entityType)
  if (compliance.length > 0) {
    parts.push(`## Compliance Requirements`)
    for (const c of compliance) {
      parts.push(`- **${c.name}** (${c.standard ?? 'internal'}): ${c.description ?? ''}`)
      if (c.checkpoints?.length) {
        for (const cp of c.checkpoints) {
          parts.push(`  - ${cp}`)
        }
      }
    }
    parts.push('')
  }

  // Behavioral instructions
  parts.push(`## Guidelines`)
  parts.push(`- Be concise and action-oriented. Users are busy professionals.`)
  parts.push(`- When helping fill forms, suggest realistic values appropriate for the ${container.industry ?? 'business'} domain.`)
  parts.push(`- When a user asks about next steps, reference the workflow transitions above.`)
  parts.push(`- If a status transition requires a specific role, inform the user.`)
  parts.push(`- For compliance-related fields, reference the compliance requirements above.`)
  parts.push(`- You can create, update, list, and link entities using your tools. Use them proactively when the user's intent is clear.`)
  parts.push(`- When creating or updating entities, always confirm the values with the user before executing unless they explicitly asked you to do it.`)
  parts.push(`- Format responses in markdown. Use tables for structured data. Keep responses under 300 words unless the user asks for detail.`)
  parts.push(``)
  parts.push(`## CRITICAL: Links and Navigation`)
  parts.push(`- NEVER write raw markdown links like [text](url). You do not know the URL structure.`)
  parts.push(`- ALWAYS use the \`navigate\` tool when the user needs to go somewhere. The tool returns the correct URL.`)
  parts.push(`- ONLY reference entity types that exist in the "Entity Types in This Application" list above. NEVER guess or invent entity type names.`)
  parts.push(`- The app URL pattern is /apps/${container.slug}/{entity_type_name} — entity_type_name uses underscores (e.g., "audit_engagement", NOT "client").`)
  parts.push(`- If you're unsure which entity type to reference, use the \`list_entities\` tool to check what exists.`)

  return parts.join('\n')
}

function buildDashboardContext(manifest: any): string {
  const parts: string[] = []
  parts.push(`## Current Page: Dashboard`)
  parts.push(`The user is viewing the application dashboard. They may ask about overall status, recent activity, or want to navigate to specific records.`)
  parts.push('')

  // Roles overview
  if (manifest.roles?.length) {
    parts.push(`### Domain Roles`)
    for (const role of manifest.roles) {
      parts.push(`- **${role.label ?? role.name}**: ${role.description ?? 'No description'}`)
    }
    parts.push('')
  }

  return parts.join('\n')
}

async function buildListContext(
  containerId: string,
  entityTypeName: string,
  entityTypes: EntityType[],
  manifest: any,
): Promise<string> {
  const parts: string[] = []
  const et = entityTypes.find(t => t.name === entityTypeName)

  parts.push(`## Current Page: ${entityTypeName.replace(/_/g, ' ')} List`)
  parts.push(`The user is viewing a list of ${entityTypeName.replace(/_/g, ' ')} records. They may want to filter, search, create new records, or understand this entity type.`)
  parts.push('')

  if (et) {
    parts.push(buildEntityTypeContext(et))
  }

  // Related types
  const relations = (manifest.relations ?? []).filter(
    (r: any) => r.source === entityTypeName || r.target === entityTypeName,
  )
  if (relations.length > 0) {
    parts.push(`### Relations`)
    for (const rel of relations) {
      parts.push(`- ${rel.source} ${rel.relation_type ?? '→'} ${rel.target} (${rel.cardinality ?? 'many_to_many'})`)
    }
    parts.push('')
  }

  return parts.join('\n')
}

async function buildDetailContext(
  containerId: string,
  pageContext: PageContext,
  entityTypes: EntityType[],
  manifest: any,
): Promise<string> {
  const parts: string[] = []
  const et = entityTypes.find(t => t.name === pageContext.entityType)

  if (pageContext.page === 'new') {
    parts.push(`## Current Page: New ${pageContext.entityType?.replace(/_/g, ' ')}`)
    parts.push(`The user is creating a new ${pageContext.entityType?.replace(/_/g, ' ')} record. Help them fill in the form fields correctly.`)
  } else {
    parts.push(`## Current Page: ${pageContext.entityType?.replace(/_/g, ' ')} Detail`)
    parts.push(`The user is viewing/editing a specific ${pageContext.entityType?.replace(/_/g, ' ')} record.`)
    if (pageContext.entityStatus) {
      parts.push(`Current status: **${pageContext.entityStatus}**`)
    }
  }
  parts.push('')

  if (et) {
    parts.push(buildEntityTypeContext(et))
  }

  // If editing, load the entity data for context
  if (pageContext.entityId) {
    try {
      const result = await query<any>('SELECT name, content, status FROM entities WHERE id = $1', [pageContext.entityId])
      if (result.rows[0]) {
        const entity = result.rows[0]
        parts.push(`### Current Record`)
        parts.push(`Name: ${entity.name}`)
        parts.push(`Status: ${entity.status}`)
        const content = entity.content ?? {}
        const filledFields = Object.entries(content).filter(([_, v]) => v !== null && v !== undefined && v !== '')
        const emptyFields = et?.data_schema?.properties
          ? Object.keys(et.data_schema.properties).filter(k => !content[k] || content[k] === '')
          : []
        parts.push(`Filled fields (${filledFields.length}): ${filledFields.map(([k]) => k).join(', ') || 'none'}`)
        if (emptyFields.length > 0) {
          parts.push(`Empty fields (${emptyFields.length}): ${emptyFields.join(', ')}`)
        }
        parts.push('')
      }
    } catch {
      // Entity might not exist yet, that's ok
    }
  }

  // Related types for linking
  const relations = (manifest.relations ?? []).filter(
    (r: any) => r.source === pageContext.entityType || r.target === pageContext.entityType,
  )
  if (relations.length > 0) {
    parts.push(`### Relations`)
    for (const rel of relations) {
      parts.push(`- ${rel.source} ${rel.relation_type ?? '→'} ${rel.target} (${rel.cardinality ?? 'many_to_many'})`)
    }
    parts.push('')
  }

  return parts.join('\n')
}

function buildEntityTypeContext(et: EntityType): string {
  const parts: string[] = []
  parts.push(`### Entity Type: ${et.name}`)
  if (et.description) parts.push(`Description: ${et.description}`)

  // Data schema fields
  if (et.data_schema?.properties) {
    const props = et.data_schema.properties as Record<string, any>
    const required = new Set<string>(et.data_schema.required ?? [])
    parts.push(`### Fields`)
    for (const [name, prop] of Object.entries(props)) {
      const req = required.has(name) ? ' **(required)**' : ''
      const type = prop.type ?? 'string'
      const desc = prop.description ? ` — ${prop.description}` : ''
      const enumVals = prop.enum ? ` [options: ${prop.enum.join(', ')}]` : ''
      parts.push(`- \`${name}\` (${type})${req}${enumVals}${desc}`)
    }
    parts.push('')
  }

  return parts.join('\n')
}

async function getWorkflows(containerId: string, entityType?: string): Promise<any[]> {
  try {
    if (entityType) {
      const result = await query(
        'SELECT * FROM cfg_workflows WHERE container_id = $1 AND entity_type = $2 AND is_active = true',
        [containerId, entityType],
      )
      return result.rows
    }
    const result = await query(
      'SELECT * FROM cfg_workflows WHERE container_id = $1 AND is_active = true LIMIT 10',
      [containerId],
    )
    return result.rows
  } catch {
    return []
  }
}

async function getCompliance(containerId: string, entityType?: string): Promise<any[]> {
  try {
    const result = await query(
      'SELECT * FROM cfg_compliance WHERE container_id = $1 AND is_active = true LIMIT 10',
      [containerId],
    )
    // Filter to relevant entity types if on a specific page
    if (entityType) {
      return result.rows.filter((c: any) =>
        !c.entity_types?.length || c.entity_types.includes(entityType),
      )
    }
    return result.rows
  } catch {
    return []
  }
}
