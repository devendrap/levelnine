/**
 * App Assistant — Tool Definitions & Executor
 *
 * Defines OpenAI function-calling tool schemas and executes them
 * server-side against existing service functions.
 */

import * as entityService from '../entities/service'
import * as relationService from '../relations/service'
import { getWorkflowInfo } from '../runtime/enforcement'

interface PageContext {
  page: 'dashboard' | 'list' | 'detail' | 'new'
  entityType?: string
  entityId?: string
  entityStatus?: string
}

interface ToolContext {
  containerId: string
  userId: string
  userRole?: string
  slug: string
  pageContext: PageContext
}

// ============================================================================
// Tool Definitions (OpenAI function calling format)
// ============================================================================

const TOOL_CREATE_ENTITY = {
  type: 'function' as const,
  function: {
    name: 'create_entity',
    description: 'Create a new entity (record) of a given type. Use when the user wants to add a new record.',
    parameters: {
      type: 'object',
      properties: {
        entity_type_name: { type: 'string', description: 'The entity type name (e.g. "audit_engagement", "client")' },
        name: { type: 'string', description: 'Display name for the new record' },
        content: { type: 'object', description: 'Field values as key-value pairs matching the entity type schema' },
      },
      required: ['entity_type_name', 'name'],
    },
  },
}

const TOOL_UPDATE_ENTITY = {
  type: 'function' as const,
  function: {
    name: 'update_entity',
    description: 'Update fields on an existing entity. Use when the user wants to change field values on the current record.',
    parameters: {
      type: 'object',
      properties: {
        entity_id: { type: 'string', description: 'The entity UUID to update' },
        name: { type: 'string', description: 'New display name (optional)' },
        content: { type: 'object', description: 'Field values to update (merged with existing content)' },
      },
      required: ['entity_id'],
    },
  },
}

const TOOL_CHANGE_STATUS = {
  type: 'function' as const,
  function: {
    name: 'change_status',
    description: 'Change the workflow status of an entity. Validates against workflow transition rules.',
    parameters: {
      type: 'object',
      properties: {
        entity_id: { type: 'string', description: 'The entity UUID' },
        new_status: { type: 'string', description: 'The target status (must be a valid workflow transition)' },
      },
      required: ['entity_id', 'new_status'],
    },
  },
}

const TOOL_LIST_ENTITIES = {
  type: 'function' as const,
  function: {
    name: 'list_entities',
    description: 'Search and list entities of a given type. Use for finding records, checking counts, or answering questions about data.',
    parameters: {
      type: 'object',
      properties: {
        entity_type_name: { type: 'string', description: 'Entity type to search' },
        status: { type: 'string', description: 'Filter by status (optional)' },
        page: { type: 'number', description: 'Page number (default 1)' },
        page_size: { type: 'number', description: 'Results per page (default 10, max 50)' },
      },
      required: ['entity_type_name'],
    },
  },
}

const TOOL_GET_ENTITY = {
  type: 'function' as const,
  function: {
    name: 'get_entity',
    description: 'Get full details of a specific entity by ID. Use to read current field values.',
    parameters: {
      type: 'object',
      properties: {
        entity_id: { type: 'string', description: 'The entity UUID to retrieve' },
      },
      required: ['entity_id'],
    },
  },
}

const TOOL_LINK_ENTITIES = {
  type: 'function' as const,
  function: {
    name: 'link_entities',
    description: 'Create a relationship between two entities (e.g., link an engagement to a client).',
    parameters: {
      type: 'object',
      properties: {
        source_entity_id: { type: 'string', description: 'Source entity UUID' },
        target_entity_id: { type: 'string', description: 'Target entity UUID' },
        relation_type: { type: 'string', description: 'Type of relation (e.g., "belongs_to", "depends_on", "reviewed_by")' },
      },
      required: ['source_entity_id', 'target_entity_id', 'relation_type'],
    },
  },
}

const TOOL_GET_WORKFLOW = {
  type: 'function' as const,
  function: {
    name: 'get_workflow',
    description: 'Get workflow information for an entity type, including available status transitions from the current status.',
    parameters: {
      type: 'object',
      properties: {
        entity_type_name: { type: 'string', description: 'Entity type name' },
        current_status: { type: 'string', description: 'Current status to get available transitions from (optional)' },
      },
      required: ['entity_type_name'],
    },
  },
}

const TOOL_NAVIGATE = {
  type: 'function' as const,
  function: {
    name: 'navigate',
    description: 'Generate a URL for the user to navigate to. Returns a clickable link. Use when suggesting the user visit a page.',
    parameters: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          enum: ['dashboard', 'entity_list', 'entity_detail', 'entity_new'],
          description: 'Navigation target type',
        },
        entity_type: { type: 'string', description: 'Entity type name (for entity_list, entity_detail, entity_new)' },
        entity_id: { type: 'string', description: 'Entity ID (for entity_detail)' },
      },
      required: ['target'],
    },
  },
}

/**
 * Get the tool definitions available for the current page context.
 * Not all tools are relevant on all pages.
 */
export function getToolsForContext(pageContext: PageContext): any[] {
  const tools = [TOOL_LIST_ENTITIES, TOOL_GET_ENTITY, TOOL_GET_WORKFLOW, TOOL_NAVIGATE]

  // Create is available everywhere except detail view of an existing entity
  if (pageContext.page !== 'detail') {
    tools.push(TOOL_CREATE_ENTITY)
  }

  // Update and status change are available on detail and new pages
  if (pageContext.page === 'detail' && pageContext.entityId) {
    tools.push(TOOL_UPDATE_ENTITY, TOOL_CHANGE_STATUS)
  }

  // Linking is available on detail pages
  if (pageContext.page === 'detail' && pageContext.entityId) {
    tools.push(TOOL_LINK_ENTITIES)
  }

  // Create is available on list and new pages
  if (pageContext.page === 'list' || pageContext.page === 'new' || pageContext.page === 'dashboard') {
    tools.push(TOOL_CREATE_ENTITY)
  }

  return tools
}

/**
 * Execute a tool call and return the result.
 * All tool execution happens server-side with proper validation.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  context: ToolContext,
): Promise<{ success: boolean; result: any; error?: string }> {
  try {
    switch (toolName) {
      case 'create_entity': {
        const entity = await entityService.createEntity({
          entity_type_name: args.entity_type_name,
          container_id: context.containerId,
          name: args.name,
          content: args.content ?? {},
          created_by_user_id: context.userId,
        })
        return {
          success: true,
          result: {
            id: entity.id,
            name: entity.name,
            status: entity.status,
            url: `/apps/${context.slug}/${args.entity_type_name}/${entity.id}`,
          },
        }
      }

      case 'update_entity': {
        const entityId = args.entity_id ?? context.pageContext.entityId
        if (!entityId) return { success: false, result: null, error: 'No entity ID provided' }

        const updateData: any = { last_modified_by_user_id: context.userId, user_role: context.userRole }
        if (args.name) updateData.name = args.name
        if (args.content) updateData.content = args.content

        const entity = await entityService.updateEntity(entityId, updateData)
        return {
          success: true,
          result: { id: entity.id, name: entity.name, status: entity.status, content: entity.content },
        }
      }

      case 'change_status': {
        const entityId = args.entity_id ?? context.pageContext.entityId
        if (!entityId) return { success: false, result: null, error: 'No entity ID provided' }

        const entity = await entityService.updateEntity(entityId, {
          status: args.new_status,
          last_modified_by_user_id: context.userId,
          user_role: context.userRole,
        })
        return {
          success: true,
          result: { id: entity.id, name: entity.name, status: entity.status },
        }
      }

      case 'list_entities': {
        const result = await entityService.listEntities({
          type: args.entity_type_name,
          container_id: context.containerId,
          status: args.status,
          page: args.page ?? 1,
          pageSize: Math.min(args.page_size ?? 10, 50),
        })
        return {
          success: true,
          result: {
            total: result.total,
            page: result.page,
            totalPages: result.totalPages,
            records: result.data.map(e => ({
              id: e.id,
              name: e.name,
              status: e.status,
              url: `/apps/${context.slug}/${args.entity_type_name}/${e.id}`,
            })),
          },
        }
      }

      case 'get_entity': {
        const entity = await entityService.getEntity(args.entity_id)
        return {
          success: true,
          result: {
            id: entity.id,
            name: entity.name,
            status: entity.status,
            content: entity.content,
          },
        }
      }

      case 'link_entities': {
        const relation = await relationService.linkEntities({
          source_entity_id: args.source_entity_id,
          target_entity_id: args.target_entity_id,
          relation_type: args.relation_type,
        })
        return { success: true, result: { linked: true, relation_type: args.relation_type } }
      }

      case 'get_workflow': {
        const wfInfo = await getWorkflowInfo(
          context.containerId,
          args.entity_type_name,
          args.current_status,
          context.userRole,
        )
        return { success: true, result: wfInfo }
      }

      case 'navigate': {
        let url = `/apps/${context.slug}`
        if (args.target === 'entity_list' && args.entity_type) {
          url += `/${args.entity_type}`
        } else if (args.target === 'entity_detail' && args.entity_type && args.entity_id) {
          url += `/${args.entity_type}/${args.entity_id}`
        } else if (args.target === 'entity_new' && args.entity_type) {
          url += `/${args.entity_type}/new`
        }
        return { success: true, result: { url, label: `Go to ${args.target.replace(/_/g, ' ')}` } }
      }

      default:
        return { success: false, result: null, error: `Unknown tool: ${toolName}` }
    }
  } catch (err: any) {
    return { success: false, result: null, error: err.message }
  }
}
