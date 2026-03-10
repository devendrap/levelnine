import * as repo from './repository'
import type { Entity, EntityType, PaginatedResult } from '../../core/types/index'

// ============================================================================
// Entity Types
// ============================================================================

export async function listEntityTypes(activeOnly = true): Promise<EntityType[]> {
  return repo.findAllEntityTypes(activeOnly)
}

export async function getEntityType(id: string): Promise<EntityType> {
  const et = await repo.findEntityTypeById(id)
  if (!et) throw new ServiceError('Entity type not found', 404)
  return et
}

export async function createEntityType(data: {
  name: string
  description?: string
  schema?: Record<string, any>
}): Promise<EntityType> {
  if (!data.name?.trim()) throw new ServiceError('Name is required', 400)

  const existing = await repo.findEntityTypeByName(data.name)
  if (existing) throw new ServiceError(`Entity type "${data.name}" already exists`, 409)

  return repo.insertEntityType(data)
}

export async function updateEntityType(
  id: string,
  data: { name?: string; description?: string; schema?: Record<string, any>; is_active?: boolean },
): Promise<EntityType> {
  if (data.name !== undefined) {
    const existing = await repo.findEntityTypeByName(data.name)
    if (existing && existing.id !== id) throw new ServiceError(`Entity type "${data.name}" already exists`, 409)
  }

  const et = await repo.updateEntityType(id, data)
  if (!et) throw new ServiceError('Entity type not found', 404)
  return et
}

// ============================================================================
// Entities
// ============================================================================

export async function getEntity(id: string): Promise<Entity & { entity_type?: EntityType }> {
  const entity = await repo.findEntityById(id)
  if (!entity) throw new ServiceError('Entity not found', 404)

  const entityType = await repo.findEntityTypeById(entity.entity_type_id)
  return { ...entity, entity_type: entityType ?? undefined }
}

export async function listEntities(filters: {
  type?: string
  parent?: string
  status?: string
  period?: string
  page?: number
  pageSize?: number
}): Promise<PaginatedResult<Entity>> {
  return repo.findEntitiesPaginated({
    entity_type_name: filters.type,
    parent_entity_id: filters.parent,
    status: filters.status,
    period: filters.period,
    page: filters.page,
    pageSize: filters.pageSize,
  })
}

export async function createEntity(data: {
  entity_type_name?: string
  entity_type_id?: string
  name: string
  content?: Record<string, any>
  metadata?: Record<string, any>
  parent_entity_id?: string
  period?: string
  created_by_user_id?: string
}): Promise<Entity> {
  if (!data.name?.trim()) throw new ServiceError('Name is required', 400)

  let typeId = data.entity_type_id
  if (!typeId && data.entity_type_name) {
    const et = await repo.findEntityTypeByName(data.entity_type_name)
    if (!et) throw new ServiceError(`Entity type "${data.entity_type_name}" not found`, 404)
    typeId = et.id
  }
  if (!typeId) throw new ServiceError('entity_type_id or entity_type_name is required', 400)

  // Check duplicate name within same type
  const existing = await repo.findEntitiesPaginated({ entity_type_id: typeId, pageSize: 1000 })
  if (existing.data.some(e => e.name === data.name)) {
    throw new ServiceError(`Entity "${data.name}" already exists for this type`, 409)
  }

  if (data.parent_entity_id) {
    const parent = await repo.findEntityById(data.parent_entity_id)
    if (!parent) throw new ServiceError('Parent entity not found', 404)
  }

  return repo.insertEntity({
    entity_type_id: typeId,
    name: data.name,
    content: data.content,
    metadata: data.metadata,
    parent_entity_id: data.parent_entity_id,
    period: data.period,
    created_by_user_id: data.created_by_user_id,
  })
}

export async function updateEntity(
  id: string,
  data: {
    name?: string
    status?: string
    content?: Record<string, any>
    metadata?: Record<string, any>
    parent_entity_id?: string | null
    period?: string | null
    last_modified_by_user_id?: string
  },
): Promise<Entity> {
  const entity = await repo.updateEntity(id, data)
  if (!entity) throw new ServiceError('Entity not found', 404)
  return entity
}

export async function deleteEntity(id: string): Promise<void> {
  const deleted = await repo.deleteEntity(id)
  if (!deleted) throw new ServiceError('Entity not found', 404)
}

// ============================================================================
// Error
// ============================================================================

export class ServiceError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}
