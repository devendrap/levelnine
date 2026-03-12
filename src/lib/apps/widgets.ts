import { query } from '../../../server/db/index'
import * as entityService from '../../../server/modules/entities/service'
import type { PageWidget } from '../../../server/core/types/index'

export interface ResolvedWidget {
  type: string
  data: any
  props: any
}

/**
 * Server-side widget resolver. Takes a widget definition + containerId and returns
 * serializable data ready for the PageRendererIsland.
 */
export async function resolveWidget(widget: PageWidget, containerId: string, slug: string): Promise<ResolvedWidget> {
  switch (widget.type) {
    case 'stats_grid': {
      const stats = await Promise.all(
        widget.entity_types.map(async (typeName) => {
          const result = await entityService.listEntities({
            type: typeName,
            container_id: containerId,
            pageSize: 1,
          })
          return { name: typeName, total: result.total }
        }),
      )
      return { type: 'stats_grid', data: stats, props: { slug } }
    }

    case 'recent_activity': {
      const limit = widget.limit ?? 10
      const result = await entityService.listEntities({
        container_id: containerId,
        pageSize: limit,
      })
      // Also get entity types for display
      const types = await entityService.listEntityTypes(true, containerId)
      const typeMap = Object.fromEntries(types.map(t => [t.id, t.name]))
      const items = result.data.map(e => ({
        id: e.id,
        name: e.name,
        status: e.status,
        typeName: typeMap[e.entity_type_id] ?? 'unknown',
        updatedAt: e.updated_at,
      }))
      return { type: 'recent_activity', data: items, props: { slug } }
    }

    case 'chart': {
      // Aggregate entities by a field
      const result = await entityService.listEntities({
        type: widget.entity_type,
        container_id: containerId,
        pageSize: 1000,
      })
      const counts: Record<string, number> = {}
      for (const entity of result.data) {
        const value = widget.group_by === 'status'
          ? entity.status
          : (entity.content as any)?.[widget.group_by] ?? 'unknown'
        counts[String(value)] = (counts[String(value)] ?? 0) + 1
      }
      return {
        type: 'chart',
        data: { labels: Object.keys(counts), values: Object.values(counts) },
        props: { chart_type: widget.chart_type, title: widget.title },
      }
    }

    case 'entity_list': {
      const result = await entityService.listEntities({
        type: widget.entity_type,
        container_id: containerId,
        status: widget.status_filter,
        pageSize: widget.limit ?? 10,
      })
      return {
        type: 'entity_list',
        data: result.data.map(e => ({
          id: e.id,
          name: e.name,
          status: e.status,
          content: e.content,
          updatedAt: e.updated_at,
        })),
        props: { columns: widget.columns, entity_type: widget.entity_type, slug },
      }
    }

    case 'quick_actions': {
      return {
        type: 'quick_actions',
        data: widget.entity_types,
        props: { slug },
      }
    }

    case 'kpi_card': {
      let value: number
      if (widget.metric === 'count') {
        const result = await entityService.listEntities({
          type: widget.entity_type,
          container_id: containerId,
          pageSize: 1,
        })
        value = result.total
      } else {
        // count_by_status
        const result = await entityService.listEntities({
          type: widget.entity_type,
          container_id: containerId,
          status: widget.status,
          pageSize: 1,
        })
        value = result.total
      }
      return {
        type: 'kpi_card',
        data: { value },
        props: { label: widget.label },
      }
    }

    case 'rich_text': {
      return {
        type: 'rich_text',
        data: widget.content,
        props: {},
      }
    }

    case 'workflow_summary': {
      const result = await entityService.listEntities({
        type: widget.entity_type,
        container_id: containerId,
        pageSize: 1000,
      })
      const statusCounts: Record<string, number> = {}
      for (const entity of result.data) {
        statusCounts[entity.status] = (statusCounts[entity.status] ?? 0) + 1
      }
      return {
        type: 'workflow_summary',
        data: { statusCounts, total: result.total },
        props: { entity_type: widget.entity_type, workflow_name: widget.workflow_name },
      }
    }

    case 'compliance_checklist': {
      const compResult = await query(
        'SELECT * FROM cfg_compliance WHERE container_id = $1 AND name = $2',
        [containerId, widget.compliance_name],
      )
      const compliance = compResult.rows[0]
      return {
        type: 'compliance_checklist',
        data: compliance ?? null,
        props: { compliance_name: widget.compliance_name },
      }
    }

    default:
      return { type: 'unknown', data: null, props: {} }
  }
}
