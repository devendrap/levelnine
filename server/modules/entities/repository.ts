import { query } from '../../db/index'
import type { Entity, EntityType, PaginatedResult } from '../../core/types/index'

// ============================================================================
// Entity Types
// ============================================================================

export async function findAllEntityTypes(activeOnly = true, containerId?: string): Promise<EntityType[]> {
  const wheres: string[] = []
  const params: any[] = []
  let idx = 1

  if (activeOnly) wheres.push('is_active = true')
  if (containerId) { wheres.push(`container_id = $${idx++}`); params.push(containerId) }

  const whereClause = wheres.length > 0 ? `WHERE ${wheres.join(' AND ')}` : ''
  const result = await query<EntityType>(`SELECT * FROM entity_types ${whereClause} ORDER BY name`, params)
  return result.rows
}

export async function findEntityTypeById(id: string): Promise<EntityType | null> {
  const result = await query<EntityType>('SELECT * FROM entity_types WHERE id = $1', [id])
  return result.rows[0] ?? null
}

export async function findEntityTypeByName(name: string, containerId?: string): Promise<EntityType | null> {
  if (containerId) {
    const result = await query<EntityType>('SELECT * FROM entity_types WHERE name = $1 AND container_id = $2', [name, containerId])
    return result.rows[0] ?? null
  }
  const result = await query<EntityType>('SELECT * FROM entity_types WHERE name = $1', [name])
  return result.rows[0] ?? null
}

export async function insertEntityType(data: {
  name: string
  description?: string
  schema?: Record<string, any>
}): Promise<EntityType> {
  const result = await query<EntityType>(
    `INSERT INTO entity_types (name, description, schema)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.name, data.description ?? null, data.schema ? JSON.stringify(data.schema) : null],
  )
  return result.rows[0]
}

export async function updateEntityType(
  id: string,
  data: { name?: string; description?: string; schema?: Record<string, any>; is_active?: boolean },
): Promise<EntityType | null> {
  const sets: string[] = []
  const params: any[] = []
  let idx = 1

  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name) }
  if (data.description !== undefined) { sets.push(`description = $${idx++}`); params.push(data.description) }
  if (data.schema !== undefined) { sets.push(`schema = $${idx++}`); params.push(JSON.stringify(data.schema)) }
  if (data.is_active !== undefined) { sets.push(`is_active = $${idx++}`); params.push(data.is_active) }

  if (sets.length === 0) return findEntityTypeById(id)

  params.push(id)
  const result = await query<EntityType>(
    `UPDATE entity_types SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params,
  )
  return result.rows[0] ?? null
}

// ============================================================================
// Entities
// ============================================================================

export async function findEntityById(id: string): Promise<Entity | null> {
  const result = await query<Entity>('SELECT * FROM entities WHERE id = $1', [id])
  return result.rows[0] ?? null
}

export async function findEntityWithTypeById(id: string): Promise<(Entity & { entity_type?: EntityType }) | null> {
  const result = await query<any>(
    `SELECT e.*, et.name as et_name, et.description as et_description,
            et.schema as et_schema, et.is_active as et_is_active,
            et.container_id as et_container_id
     FROM entities e
     LEFT JOIN entity_types et ON et.id = e.entity_type_id
     WHERE e.id = $1`,
    [id],
  )
  const row = result.rows[0]
  if (!row) return null

  const entity_type: EntityType | undefined = row.et_name ? {
    id: row.entity_type_id,
    name: row.et_name,
    description: row.et_description,
    schema: row.et_schema,
    container_id: row.et_container_id,
    is_active: row.et_is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  } : undefined

  return { ...row, entity_type }
}

/** Batch count entities per entity type for a container — single query instead of N+1 */
export async function countEntitiesByType(containerId: string): Promise<Array<{ name: string; total: number }>> {
  const result = await query<{ name: string; total: string }>(
    `SELECT et.name, COUNT(e.id)::text AS total
     FROM entity_types et
     LEFT JOIN entities e ON e.entity_type_id = et.id
     WHERE et.container_id = $1 AND et.is_active = true
     GROUP BY et.name
     ORDER BY et.name`,
    [containerId],
  )
  return result.rows.map(r => ({ name: r.name, total: parseInt(r.total, 10) }))
}

export async function findEntitiesPaginated(filters: {
  entity_type_id?: string
  entity_type_name?: string
  container_id?: string
  status?: string
  period?: string
  page?: number
  pageSize?: number
}): Promise<PaginatedResult<Entity>> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25))
  const offset = (page - 1) * pageSize

  const wheres: string[] = []
  const params: any[] = []
  let idx = 1

  if (filters.entity_type_id) {
    wheres.push(`e.entity_type_id = $${idx++}`)
    params.push(filters.entity_type_id)
  }
  if (filters.entity_type_name) {
    wheres.push(`et.name = $${idx++}`)
    params.push(filters.entity_type_name)
  }
  if (filters.container_id) {
    wheres.push(`e.container_id = $${idx++}`)
    params.push(filters.container_id)
  }
  if (filters.status) {
    wheres.push(`e.status = $${idx++}`)
    params.push(filters.status)
  }
  if (filters.period) {
    wheres.push(`e.period = $${idx++}`)
    params.push(filters.period)
  }

  const whereClause = wheres.length > 0 ? `WHERE ${wheres.join(' AND ')}` : ''
  const joinClause = filters.entity_type_name ? 'JOIN entity_types et ON et.id = e.entity_type_id' : ''

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM entities e ${joinClause} ${whereClause}`,
    params,
  )
  const total = parseInt(countResult.rows[0].count, 10)

  params.push(pageSize, offset)
  const dataResult = await query<Entity>(
    `SELECT e.* FROM entities e ${joinClause} ${whereClause}
     ORDER BY e.created_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    params,
  )

  return {
    data: dataResult.rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function insertEntity(data: {
  entity_type_id: string
  container_id?: string
  name: string
  content?: Record<string, any>
  metadata?: Record<string, any>
  period?: string
  status?: string
  s3_key?: string
  original_filename?: string
  created_by_user_id?: string
}): Promise<Entity> {
  const result = await query<Entity>(
    `INSERT INTO entities (entity_type_id, container_id, name, content, metadata, period, status, s3_key, original_filename, created_by_user_id, last_modified_by_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
     RETURNING *`,
    [
      data.entity_type_id,
      data.container_id ?? null,
      data.name,
      JSON.stringify(data.content ?? {}),
      JSON.stringify(data.metadata ?? {}),
      data.period ?? null,
      data.status ?? 'draft',
      data.s3_key ?? null,
      data.original_filename ?? null,
      data.created_by_user_id ?? null,
    ],
  )
  return result.rows[0]
}

export async function updateEntity(
  id: string,
  data: {
    name?: string
    status?: string
    content?: Record<string, any>
    metadata?: Record<string, any>
    period?: string | null
    s3_key?: string | null
    original_filename?: string | null
    processing_status?: string
    last_modified_by_user_id?: string
  },
): Promise<Entity | null> {
  const sets: string[] = []
  const params: any[] = []
  let idx = 1

  if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name) }
  if (data.status !== undefined) { sets.push(`status = $${idx++}`); params.push(data.status) }
  if (data.content !== undefined) { sets.push(`content = $${idx++}`); params.push(JSON.stringify(data.content)) }
  if (data.metadata !== undefined) { sets.push(`metadata = $${idx++}`); params.push(JSON.stringify(data.metadata)) }
  if (data.period !== undefined) { sets.push(`period = $${idx++}`); params.push(data.period) }
  if (data.s3_key !== undefined) { sets.push(`s3_key = $${idx++}`); params.push(data.s3_key) }
  if (data.original_filename !== undefined) { sets.push(`original_filename = $${idx++}`); params.push(data.original_filename) }
  if (data.processing_status !== undefined) { sets.push(`processing_status = $${idx++}`); params.push(data.processing_status) }
  if (data.last_modified_by_user_id !== undefined) { sets.push(`last_modified_by_user_id = $${idx++}`); params.push(data.last_modified_by_user_id) }

  if (sets.length === 0) return findEntityById(id)

  params.push(id)
  const result = await query<Entity>(
    `UPDATE entities SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params,
  )
  return result.rows[0] ?? null
}

export async function deleteEntity(id: string): Promise<boolean> {
  const result = await query('DELETE FROM entities WHERE id = $1', [id])
  return (result.rowCount ?? 0) > 0
}
