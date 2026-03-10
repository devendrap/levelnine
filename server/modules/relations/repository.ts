import { query } from '../../db/index'
import type { EntityRelation } from '../../core/types/index'

export async function findRelationsByEntity(
  entityId: string,
  direction: 'source' | 'target' | 'both' = 'both',
): Promise<EntityRelation[]> {
  if (direction === 'source') {
    const result = await query<EntityRelation>('SELECT * FROM entity_relations WHERE source_entity_id = $1 ORDER BY created_at', [entityId])
    return result.rows
  }
  if (direction === 'target') {
    const result = await query<EntityRelation>('SELECT * FROM entity_relations WHERE target_entity_id = $1 ORDER BY created_at', [entityId])
    return result.rows
  }
  const result = await query<EntityRelation>(
    'SELECT * FROM entity_relations WHERE source_entity_id = $1 OR target_entity_id = $1 ORDER BY created_at',
    [entityId],
  )
  return result.rows
}

export async function findRelationsByType(relationType: string): Promise<EntityRelation[]> {
  const result = await query<EntityRelation>('SELECT * FROM entity_relations WHERE relation_type = $1 ORDER BY created_at', [relationType])
  return result.rows
}

export async function insertRelation(data: {
  source_entity_id: string
  target_entity_id: string
  relation_type: string
  metadata?: Record<string, any>
}): Promise<EntityRelation> {
  const result = await query<EntityRelation>(
    `INSERT INTO entity_relations (source_entity_id, target_entity_id, relation_type, metadata)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (source_entity_id, target_entity_id, relation_type) DO UPDATE SET metadata = $4
     RETURNING *`,
    [data.source_entity_id, data.target_entity_id, data.relation_type, JSON.stringify(data.metadata ?? {})],
  )
  return result.rows[0]
}

export async function deleteRelation(id: string): Promise<boolean> {
  const result = await query('DELETE FROM entity_relations WHERE id = $1', [id])
  return (result.rowCount ?? 0) > 0
}

export async function deleteRelationByEntities(
  sourceId: string,
  targetId: string,
  relationType: string,
): Promise<boolean> {
  const result = await query(
    'DELETE FROM entity_relations WHERE source_entity_id = $1 AND target_entity_id = $2 AND relation_type = $3',
    [sourceId, targetId, relationType],
  )
  return (result.rowCount ?? 0) > 0
}
