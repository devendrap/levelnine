import type { ContainerManifest, DimensionConfig } from '../../core/types/index'

// Dimension-specific artifact schemas for the output format
const DIMENSION_ARTIFACTS: Record<string, string> = {
  structure: '',  // D1 uses only entity_types + relations (base fields)
  consolidation: `  "entity_types_removed": [{"name": "type_to_remove", "reason": "enum merged into parent_type.field_name", "absorbed_by": "parent_type"}],
  "merges_applied": [{"source": "type_a_removed", "target": "type_b_kept", "strategy": "combined fields, added source enum field"}],`,
  roles: `  "roles_added": [{"name": "snake_case", "label": "Human Label", "description": "...", "permissions": ["action:resource"], "restricted_entity_types": [{"type": "entity_name", "justification": "business reason for restriction"}]}],`,
  workflows: `  "workflows_added": [{"name": "snake_case", "label": "Human Label", "description": "...", "entity_type": "which_entity", "statuses": ["draft","active","complete"], "transitions": [{"from": "draft", "to": "active", "role": "role_name", "conditions": "optional"}]}],`,
  compliance: `  "compliance_added": [{"name": "snake_case", "standard": "PCAOB AS 2201", "description": "...", "entity_types": ["affected_types"], "checkpoints": ["what must be verified"]}],`,
  documents: `  "documents_added": [{"name": "snake_case", "label": "Human Label", "description": "...", "entity_type": "optional_owner", "format": "pdf", "retention_days": 365}],`,
  integrations: `  "integrations_added": [{"name": "snake_case", "label": "Human Label", "description": "...", "system_type": "erp|crm|filing|api", "direction": "import|export|bidirectional", "entity_types": ["synced_types"], "config": {}}],`,
  reporting: `  "reports_added": [{"name": "snake_case", "label": "Human Label", "description": "...", "report_type": "dashboard|scheduled|ad_hoc", "entity_types": ["data_sources"], "schedule": "on_demand"}],`,
  edge_cases: `  "edge_cases_added": [{"name": "snake_case", "label": "Human Label", "description": "...", "category": "exception|error_recovery|boundary|concurrency", "entity_types": ["affected_types"], "handling": "how to handle"}],`,
  notifications: `  "notifications_added": [{"name": "snake_case", "label": "Human Label", "description": "...", "trigger_entity_type": "entity_name", "trigger_event": "status_change|created|updated|field_change|sla_breach", "trigger_condition": "status == 'pending_approval'", "recipients": ["role_name"], "channel": "email|in_app|both", "escalation_minutes": 2880, "escalation_to": "senior_role", "template": "Notification message with {{entity_name}} variables"}],`,
  ui_navigation: `  "ui_configs_added": [{"name": "snake_case_list_view", "label": "Human Label", "entity_type": "entity_name", "view_type": "master_detail|full_page|dashboard|grid_only", "grid_config": {"columns": [{"field": "field_name", "label": "Column Label", "width": "150px", "sortable": true}], "default_sort": {"field": "name", "direction": "asc"}, "row_actions": ["edit","archive"], "bulk_actions": ["export"]}, "detail_config": {"layout": "tabs|accordion|sections", "sections": [{"label": "Section Name", "fields": ["field1","field2"], "related_entity_type": "optional_nested_entity"}]}, "navigation": {"menu_group": "Main|Settings|Reports", "icon": "optional", "sort_order": 1}}],`,
  pages_dashboard: `  "pages_added": [{"name": "home", "label": "Home", "route": "home", "icon": "home", "layout": "grid", "is_default": true, "sections": [{"title": "Key Metrics", "width": "full", "widget": {"type": "stats_grid", "entity_types": ["type1","type2"]}}, {"title": "Recent Activity", "width": "half", "widget": {"type": "recent_activity", "limit": 10}}, {"title": "Status Overview", "width": "half", "widget": {"type": "chart", "chart_type": "doughnut", "entity_type": "main_type", "group_by": "status", "title": "Status Distribution"}}], "access_roles": []}],
  "seed_data": [{"entity_type": "type_name", "records": [{"name": "Realistic Name", "status": "active", "content": {"field1": "value1", "field2": "value2"}}]}],`,
}

// Universal step wrappers (from env or defaults)
const GENERATE_WRAPPER = process.env.EXPLORATION_GENERATE_WRAPPER ?? `You are exploring the "{{dimension_label}}" dimension for the "{{container_name}}" application.

Current manifest state:
{{manifest_summary}}

## Your Task
{{dimension_prompt}}

## Output Format
Respond with a structured analysis. At the end, include a JSON block wrapped in \`\`\`json:exploration_output markers:
\`\`\`json:exploration_output
{
  "entity_types_added": [{"name": "snake_case", "description": "...", "key_fields": ["..."]}],
  "entity_types_modified": [{"name": "existing_name", "changes": {"description": "new desc", "key_fields": ["updated"]}}],
  "relations_added": [{"source_type": "...", "target_type": "...", "relation_type": "...", "description": "..."}],
{{dimension_artifacts}}
  "scope_items": ["items this dimension covers"],
  "out_of_scope_items": [{"item": "...", "reason": "..."}]
}
\`\`\``

const REVIEW_WRAPPER = process.env.EXPLORATION_REVIEW_WRAPPER ?? `You are self-reviewing your "{{dimension_label}}" analysis for "{{container_name}}".

Your previous output:
{{previous_output}}

Current manifest:
{{manifest_summary}}

## Review Criteria
1. **Completeness**: Did you miss any entity types, relations, or fields that a domain expert would expect?
2. **Accuracy**: Are the descriptions, key_fields, and relation types correct and specific?
3. **Naming**: Are names consistent, snake_case, and domain-specific (not generic)?
4. **Overlap**: Are there duplicates or conflicts with existing entity types?

## Output Format
Provide your review, then a JSON block:
\`\`\`json:exploration_output
{
  "entity_types_added": [],
  "entity_types_modified": [],
  "relations_added": [],
  "issues_found": ["list of issues"],
  "corrections_applied": ["list of corrections"]
}
\`\`\``

const GAPS_WRAPPER = process.env.EXPLORATION_GAPS_WRAPPER ?? `You are identifying gaps in the "{{dimension_label}}" dimension for "{{container_name}}".

Full manifest after generation + review:
{{manifest_summary}}

All dimensions: {{all_dimensions}}
Completed dimensions: {{completed_dimensions}}

## Your Task
1. Identify any remaining gaps in this dimension
2. Flag topics that belong to OTHER dimensions (do not explore them now)
3. Identify items that are out of scope for this application
4. Suggest areas worth deeper exploration

## Output Format
\`\`\`json:exploration_output
{
  "entity_types_added": [],
  "relations_added": [],
  "explore_opportunities": [{"dimension": "...", "topic": "...", "reason": "..."}],
  "out_of_scope_items": [{"item": "...", "reason": "..."}],
  "gaps_summary": "brief summary of gaps found"
}
\`\`\``

const GATE_WRAPPER = process.env.EXPLORATION_GATE_WRAPPER ?? `Summarize the "{{dimension_label}}" exploration for "{{container_name}}" for the admin to review.

## What was done
{{step_summaries}}

## Current manifest state
- Entity types: {{entity_type_count}}
- Relations: {{relation_count}}

## Summary for Admin
Provide a clear, concise summary of:
1. What entity types and relations were added/modified
2. Any issues found and corrected during review
3. Explore opportunities identified for other dimensions
4. Items flagged as out of scope
5. Your recommendation: continue to next dimension, go deeper into this one, or skip

Keep it brief — the admin is not a domain expert, just needs to authorize progress.`

export function buildPrompt(
  step: 'generate' | 'self_review' | 'gaps' | 'gate',
  dimension: DimensionConfig,
  containerName: string,
  manifest: ContainerManifest,
  context: {
    previousOutput?: string
    stepSummaries?: string
    allDimensions?: string[]
    completedDimensions?: string[]
  } = {},
): string {
  const manifestSummary = buildManifestSummary(manifest)
  const entityTypeCount = (manifest.entity_types ?? []).length
  const relationCount = (manifest.relations ?? []).length

  const dimensionArtifacts = DIMENSION_ARTIFACTS[dimension.dimension] ?? ''

  const replacements: Record<string, string> = {
    '{{dimension_label}}': dimension.label,
    '{{dimension_prompt}}': dimension.system_prompt,
    '{{container_name}}': containerName,
    '{{manifest_summary}}': manifestSummary,
    '{{dimension_artifacts}}': dimensionArtifacts,
    '{{previous_output}}': context.previousOutput ?? '',
    '{{step_summaries}}': context.stepSummaries ?? '',
    '{{all_dimensions}}': (context.allDimensions ?? []).join(', '),
    '{{completed_dimensions}}': (context.completedDimensions ?? []).join(', '),
    '{{entity_type_count}}': String(entityTypeCount),
    '{{relation_count}}': String(relationCount),
  }

  let template: string
  switch (step) {
    case 'generate': template = GENERATE_WRAPPER; break
    case 'self_review': template = REVIEW_WRAPPER; break
    case 'gaps': template = GAPS_WRAPPER; break
    case 'gate': template = GATE_WRAPPER; break
  }

  for (const [key, value] of Object.entries(replacements)) {
    template = template.replaceAll(key, value)
  }

  return template
}

function buildManifestSummary(manifest: ContainerManifest): string {
  const parts: string[] = []

  const entityTypes = manifest.entity_types ?? []
  if (entityTypes.length > 0) {
    parts.push(`## Entity Types (${entityTypes.length})`)
    for (const et of entityTypes) {
      const fields = et.key_fields?.length ? ` [${et.key_fields.join(', ')}]` : ''
      const dim = et.source_dimension ? ` (from: ${et.source_dimension})` : ''
      parts.push(`- **${et.name}**: ${et.description}${fields}${dim}`)
    }
  }

  const relations = manifest.relations ?? []
  if (relations.length > 0) {
    parts.push(`\n## Relations (${relations.length})`)
    for (const r of relations) {
      parts.push(`- ${r.source_type} --[${r.relation_type}]--> ${r.target_type}${r.description ? `: ${r.description}` : ''}`)
    }
  }

  const roles = manifest.roles ?? []
  if (roles.length > 0) {
    parts.push(`\n## Roles (${roles.length})`)
    for (const r of roles) {
      const restrictions = r.restricted_entity_types?.length
        ? ` — restricted from: ${r.restricted_entity_types.map((rt: any) => typeof rt === 'string' ? rt : rt.type).join(', ')}`
        : ' — full access'
      parts.push(`- **${r.name}** (${r.label}): ${r.description} — permissions: ${r.permissions.join(', ')}${restrictions}`)
    }
  }

  const workflows = manifest.workflows ?? []
  if (workflows.length > 0) {
    parts.push(`\n## Workflows (${workflows.length})`)
    for (const w of workflows) {
      parts.push(`- **${w.name}** on ${w.entity_type}: ${w.statuses.join(' → ')}`)
    }
  }

  const compliance = manifest.compliance ?? []
  if (compliance.length > 0) {
    parts.push(`\n## Compliance (${compliance.length})`)
    for (const c of compliance) {
      parts.push(`- **${c.name}** (${c.standard}): ${c.description}`)
    }
  }

  const documents = manifest.documents ?? []
  if (documents.length > 0) {
    parts.push(`\n## Documents (${documents.length})`)
    for (const d of documents) {
      parts.push(`- **${d.name}** (${d.format}): ${d.description}`)
    }
  }

  const integrations = manifest.integrations ?? []
  if (integrations.length > 0) {
    parts.push(`\n## Integrations (${integrations.length})`)
    for (const i of integrations) {
      parts.push(`- **${i.name}** (${i.system_type}, ${i.direction}): ${i.description}`)
    }
  }

  const reports = manifest.reports ?? []
  if (reports.length > 0) {
    parts.push(`\n## Reports (${reports.length})`)
    for (const r of reports) {
      parts.push(`- **${r.name}** (${r.report_type}): ${r.description}`)
    }
  }

  const edgeCases = manifest.edge_cases ?? []
  if (edgeCases.length > 0) {
    parts.push(`\n## Edge Cases (${edgeCases.length})`)
    for (const e of edgeCases) {
      parts.push(`- **${e.name}** (${e.category}): ${e.description}`)
    }
  }

  const notifications = manifest.notifications ?? []
  if (notifications.length > 0) {
    parts.push(`\n## Notifications (${notifications.length})`)
    for (const n of notifications) {
      parts.push(`- **${n.name}** (${n.trigger_event} on ${n.trigger_entity_type}): ${n.description} → ${n.recipients.join(', ')} via ${n.channel}`)
    }
  }

  const uiConfigs = manifest.ui_configs ?? []
  if (uiConfigs.length > 0) {
    parts.push(`\n## UI Configs (${uiConfigs.length})`)
    for (const u of uiConfigs) {
      parts.push(`- **${u.name}** (${u.view_type} for ${u.entity_type}): ${u.label}`)
    }
  }

  const pages = manifest.pages ?? []
  if (pages.length > 0) {
    parts.push(`\n## Pages (${pages.length})`)
    for (const p of pages) {
      parts.push(`- **${p.name}** (${p.layout}): ${p.label}${p.is_default ? ' [DEFAULT]' : ''} — ${p.sections.length} sections`)
    }
  }

  const seedData = manifest.seed_data ?? []
  if (seedData.length > 0) {
    parts.push(`\n## Seed Data (${seedData.length} types)`)
    for (const s of seedData) {
      parts.push(`- **${s.entity_type}**: ${s.records.length} records`)
    }
  }

  if (manifest.scope?.length) {
    parts.push(`\n## Scope: ${manifest.scope.join(', ')}`)
  }

  if (manifest.out_of_scope?.length) {
    parts.push(`\n## Out of Scope: ${manifest.out_of_scope.join(', ')}`)
  }

  return parts.length > 0 ? parts.join('\n') : '(empty manifest)'
}

export interface ParsedExplorationOutput {
  entity_types_added?: Array<{ name: string; description: string; key_fields?: string[] }>
  entity_types_modified?: Array<{ name: string; changes: Record<string, any> }>
  relations_added?: Array<{ source_type: string; target_type: string; relation_type: string; description?: string }>
  relations_modified?: Array<{ source_type: string; target_type: string; changes: Record<string, any> }>
  // D2-D8 dimension-specific artifacts
  // Consolidation dimension
  entity_types_removed?: Array<{ name: string; reason: string; absorbed_by: string }>
  merges_applied?: Array<{ source: string; target: string; strategy: string }>
  roles_added?: Array<{ name: string; label: string; description: string; permissions: string[]; restricted_entity_types: Array<{ type: string; justification: string }> }>
  workflows_added?: Array<{ name: string; label: string; description: string; entity_type: string; statuses: string[]; transitions: Array<{ from: string; to: string; role: string; conditions?: string }> }>
  compliance_added?: Array<{ name: string; standard: string; description: string; entity_types: string[]; checkpoints: string[] }>
  documents_added?: Array<{ name: string; label: string; description: string; entity_type?: string; format: string; retention_days?: number }>
  integrations_added?: Array<{ name: string; label: string; description: string; system_type: string; direction: string; entity_types: string[]; config: Record<string, any> }>
  reports_added?: Array<{ name: string; label: string; description: string; report_type: string; entity_types: string[]; schedule?: string }>
  edge_cases_added?: Array<{ name: string; label: string; description: string; category: string; entity_types: string[]; handling: string }>
  notifications_added?: Array<{ name: string; label: string; description: string; trigger_entity_type: string; trigger_event: string; trigger_condition?: string; recipients: string[]; channel: string; escalation_minutes?: number; escalation_to?: string; template?: string }>
  ui_configs_added?: Array<{ name: string; label: string; entity_type: string; view_type: string; grid_config: Record<string, any>; detail_config?: Record<string, any>; navigation?: Record<string, any> }>
  pages_added?: Array<{ name: string; label: string; route: string; icon?: string; layout: 'single' | 'two_column' | 'grid'; is_default?: boolean; sections: Array<{ title?: string; width?: string; widget: any }>; access_roles?: string[] }>
  seed_data?: Array<{ entity_type: string; records: Array<{ name: string; status: string; content: Record<string, any> }> }>
  explore_opportunities?: Array<{ dimension: string; topic: string; reason: string }>
  out_of_scope_items?: Array<{ item: string; reason: string }>
  scope_items?: string[]
  issues_found?: string[]
  corrections_applied?: string[]
  gaps_summary?: string
}

export function parseExplorationOutput(llmOutput: string): ParsedExplorationOutput | null {
  const match = llmOutput.match(/```json:exploration_output\s*([\s\S]*?)```/)
  if (!match) return null

  try {
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}
