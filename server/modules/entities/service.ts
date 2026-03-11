import * as repo from './repository'
import type { Entity, EntityType, PaginatedResult } from '../../core/types/index'
import { validate, type ValidationResult } from '../validation/engine'
import { triggerNotifications } from '../notifications/trigger'

// ============================================================================
// Entity Types
// ============================================================================

export async function listEntityTypes(activeOnly = true, containerId?: string): Promise<EntityType[]> {
  return repo.findAllEntityTypes(activeOnly, containerId)
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
  const entity = await repo.findEntityWithTypeById(id)
  if (!entity) throw new ServiceError('Entity not found', 404)
  return entity
}

export async function listEntities(filters: {
  type?: string
  container_id?: string
  status?: string
  period?: string
  page?: number
  pageSize?: number
}): Promise<PaginatedResult<Entity>> {
  return repo.findEntitiesPaginated({
    entity_type_name: filters.type,
    container_id: filters.container_id,
    status: filters.status,
    period: filters.period,
    page: filters.page,
    pageSize: filters.pageSize,
  })
}

export async function createEntity(data: {
  entity_type_name?: string
  entity_type_id?: string
  container_id?: string
  name: string
  content?: Record<string, any>
  metadata?: Record<string, any>
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

  // Run validation rules (C3)
  if (data.container_id && data.content) {
    const et = await repo.findEntityTypeById(typeId)
    if (et) {
      const violations = await validate(data.container_id, et.name, data.content)
      const errors = violations.filter(v => v.severity === 'error')
      if (errors.length > 0) {
        throw new ValidationError('Validation failed', errors, violations.filter(v => v.severity === 'warning'))
      }
    }
  }

  let entity: Entity
  try {
    entity = await repo.insertEntity({
      entity_type_id: typeId,
      container_id: data.container_id,
      name: data.name,
      content: data.content,
      metadata: data.metadata,
      period: data.period,
      created_by_user_id: data.created_by_user_id,
    })
  } catch (err: any) {
    if (err.code === '23505') throw new ServiceError(`Entity "${data.name}" already exists for this type`, 409)
    throw err
  }

  // Fire D9 notification rules (async, don't block response)
  if (data.container_id) {
    const et = await repo.findEntityTypeById(typeId)
    if (et) {
      triggerNotifications({
        container_id: data.container_id,
        entity_id: entity.id,
        entity_type: et.name,
        entity_name: entity.name,
        action: 'create',
        new_values: data.content,
      }).catch(e => console.error('[notify]', e.message))
    }
  }

  return entity
}

export async function updateEntity(
  id: string,
  data: {
    name?: string
    status?: string
    content?: Record<string, any>
    metadata?: Record<string, any>
    period?: string | null
    last_modified_by_user_id?: string
  },
): Promise<Entity> {
  // Run validation rules on content changes (C3)
  if (data.content) {
    const existing = await repo.findEntityById(id)
    if (existing?.container_id) {
      const et = await repo.findEntityTypeById(existing.entity_type_id)
      if (et) {
        const violations = await validate(existing.container_id, et.name, data.content)
        const errors = violations.filter(v => v.severity === 'error')
        if (errors.length > 0) {
          throw new ValidationError('Validation failed', errors, violations.filter(v => v.severity === 'warning'))
        }
      }
    }
  }

  // Fetch pre-update state for status change detection
  const preUpdate = data.content ? null : await repo.findEntityById(id)

  const entity = await repo.updateEntity(id, data)
  if (!entity) throw new ServiceError('Entity not found', 404)

  // Fire D9 notification rules (async, don't block response)
  if (entity.container_id) {
    const et = await repo.findEntityTypeById(entity.entity_type_id)
    if (et) {
      const action = (data.status && preUpdate && preUpdate.status !== data.status)
        ? 'status_change' as const
        : 'update' as const
      triggerNotifications({
        container_id: entity.container_id,
        entity_id: entity.id,
        entity_type: et.name,
        entity_name: entity.name,
        action,
        field_changes: data.content ?? {},
        new_values: { ...entity.content, status: entity.status },
      }).catch(e => console.error('[notify]', e.message))
    }
  }

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

export class ValidationError extends ServiceError {
  constructor(
    message: string,
    public errors: ValidationResult[],
    public warnings: ValidationResult[],
  ) {
    super(message, 422)
    this.name = 'ValidationError'
  }
}
