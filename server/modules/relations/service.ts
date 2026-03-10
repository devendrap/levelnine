import * as repo from './repository'
import * as entityRepo from '../entities/repository'
import type { EntityRelation } from '../../core/types/index'

export class RelationError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'RelationError'
  }
}

export async function linkEntities(data: {
  source_entity_id: string
  target_entity_id: string
  relation_type: string
  metadata?: Record<string, any>
}): Promise<EntityRelation> {
  if (!data.relation_type?.trim()) throw new RelationError('relation_type is required', 400)

  const source = await entityRepo.findEntityById(data.source_entity_id)
  if (!source) throw new RelationError('Source entity not found', 404)

  const target = await entityRepo.findEntityById(data.target_entity_id)
  if (!target) throw new RelationError('Target entity not found', 404)

  if (data.source_entity_id === data.target_entity_id) {
    throw new RelationError('Cannot relate an entity to itself', 400)
  }

  return repo.insertRelation(data)
}

export async function unlinkEntities(
  sourceId: string,
  targetId: string,
  relationType: string,
): Promise<void> {
  const deleted = await repo.deleteRelationByEntities(sourceId, targetId, relationType)
  if (!deleted) throw new RelationError('Relation not found', 404)
}

export async function getEntityRelations(
  entityId: string,
  direction?: 'source' | 'target' | 'both',
): Promise<EntityRelation[]> {
  return repo.findRelationsByEntity(entityId, direction)
}

export async function deleteRelation(id: string): Promise<void> {
  const deleted = await repo.deleteRelation(id)
  if (!deleted) throw new RelationError('Relation not found', 404)
}
