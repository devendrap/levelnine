import type { ContainerManifest, DimensionConfig } from '../../core/types/index'

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

  const replacements: Record<string, string> = {
    '{{dimension_label}}': dimension.label,
    '{{dimension_prompt}}': dimension.system_prompt,
    '{{container_name}}': containerName,
    '{{manifest_summary}}': manifestSummary,
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

  if (manifest.scope?.length) {
    parts.push(`\n## Scope: ${manifest.scope.join(', ')}`)
  }

  if (manifest.out_of_scope?.length) {
    parts.push(`\n## Out of Scope: ${manifest.out_of_scope.join(', ')}`)
  }

  return parts.length > 0 ? parts.join('\n') : '(empty manifest)'
}

export function parseExplorationOutput(llmOutput: string): {
  entity_types_added?: Array<{ name: string; description: string; key_fields?: string[] }>
  entity_types_modified?: Array<{ name: string; changes: Record<string, any> }>
  relations_added?: Array<{ source_type: string; target_type: string; relation_type: string; description?: string }>
  relations_modified?: Array<{ source_type: string; target_type: string; changes: Record<string, any> }>
  explore_opportunities?: Array<{ dimension: string; topic: string; reason: string }>
  out_of_scope_items?: Array<{ item: string; reason: string }>
  scope_items?: string[]
  issues_found?: string[]
  corrections_applied?: string[]
  gaps_summary?: string
} | null {
  const match = llmOutput.match(/```json:exploration_output\s*([\s\S]*?)```/)
  if (!match) return null

  try {
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}
