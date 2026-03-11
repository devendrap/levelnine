import type { EntityTypeDef, MessageSegment } from './types'
import { escapeHtml, renderMarkdownSegment } from './markdown'

/** Extract a type def from parsed JSON, handling both legacy and type package formats */
function extractTypeDef(e: any): EntityTypeDef {
  // Type package format: has ui_spec as the schema, plus data_schema etc.
  const schema = e.ui_spec ?? e.schema ?? null
  return {
    name: e.name,
    description: e.description,
    schema,
    key_fields: e.key_fields,
    data_schema: e.data_schema,
    field_metadata: e.field_metadata,
    related_types: e.related_types,
    document_slots: e.document_slots,
    report_relevance: e.report_relevance,
  }
}

export function parseEntityTypesFromMessage(content: string): EntityTypeDef[] {
  const summaryMatch = content.match(/```json:entity_types\n([\s\S]*?)```/)
  if (summaryMatch) {
    try {
      const parsed = JSON.parse(summaryMatch[1].trim())
      if (Array.isArray(parsed)) {
        return parsed
          .filter((e: any) => e.name && e.description)
          .map((e: any) => extractTypeDef(e))
      }
    } catch { /* fall through */ }
  }

  const entityTypes: EntityTypeDef[] = []
  const blockRegex = /```json\n([\s\S]*?)```/g
  let match
  while ((match = blockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (Array.isArray(parsed) && parsed[0]?.name && parsed[0]?.description) {
        for (const e of parsed) {
          entityTypes.push(extractTypeDef(e))
        }
        continue
      }
      // Type package format: { ui_spec, data_schema, ... } with a name context
      if (parsed.ui_spec && parsed.data_schema) {
        // Standalone type package — name must be inferred from ui_spec title or surrounding text
        const title = parsed.ui_spec?.props?.title
        if (title) {
          const name = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
          entityTypes.push({
            name,
            description: title,
            schema: parsed.ui_spec,
            key_fields: Object.keys(parsed.data_schema?.properties ?? {}).slice(0, 5),
            data_schema: parsed.data_schema,
            field_metadata: parsed.field_metadata,
            related_types: parsed.related_types,
            document_slots: parsed.document_slots,
            report_relevance: parsed.report_relevance,
          })
        }
        continue
      }
      if (parsed.type === 'Container' && parsed.children) {
        const heading = parsed.children.find((c: any) => c.type === 'Heading')
        if (heading?.props?.text) {
          const name = heading.props.text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
          entityTypes.push({ name, description: heading.props.text, schema: parsed })
        }
      }
    } catch { /* skip */ }
  }

  return entityTypes
}

export function parseMessageSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = []
  const blockRegex = /```(json:entity_types|json)\n([\s\S]*?)```/g
  let lastIndex = 0
  let match

  while ((match = blockRegex.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index)
    if (before.trim()) {
      segments.push({ kind: 'html', html: renderMarkdownSegment(before) })
    }

    const tag = match[1]
    const raw = match[2].trim()

    if (tag === 'json:entity_types') {
      segments.push({ kind: 'meta' })
    } else {
      try {
        const parsed = JSON.parse(raw)
        if (parsed.type && parsed.props) {
          const heading = parsed.children?.find?.((c: any) => c.type === 'Heading')
          const name = heading?.props?.text ?? parsed.type
          segments.push({ kind: 'schema', name, description: name, schema: parsed })
        } else if (Array.isArray(parsed) && parsed[0]?.name && parsed[0]?.schema) {
          for (const et of parsed) {
            if (et.schema) {
              segments.push({ kind: 'schema', name: et.name, description: et.description ?? et.name, schema: et.schema })
            }
          }
        } else {
          segments.push({ kind: 'html', html: `<pre class="cm-codeblock"><code>${escapeHtml(raw)}</code></pre>` })
        }
      } catch {
        segments.push({ kind: 'html', html: `<pre class="cm-codeblock"><code>${escapeHtml(raw)}</code></pre>` })
      }
    }

    lastIndex = match.index + match[0].length
  }

  const after = content.slice(lastIndex)
  if (after.trim()) {
    segments.push({ kind: 'html', html: renderMarkdownSegment(after) })
  }

  return segments
}
