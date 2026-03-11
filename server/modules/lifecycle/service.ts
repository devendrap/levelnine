import * as repo from './repository'
import * as entityRepo from '../entities/repository'
import { query } from '../../db/index'

/**
 * Process lifecycle policies for a container.
 * Called by a background job / cron.
 * Returns count of entities affected.
 */
export async function processContainerPolicies(containerId: string): Promise<number> {
  const policies = await repo.findByContainer(containerId)
  let affected = 0

  for (const policy of policies) {
    affected += await processPolicy(policy)
  }

  return affected
}

async function processPolicy(policy: repo.LifecyclePolicy): Promise<number> {
  switch (policy.trigger_type) {
    case 'age':
      return processAgePolicy(policy)
    case 'status':
      return processStatusPolicy(policy)
    case 'manual':
      return 0 // manual policies are triggered by API, not background job
  }
}

/**
 * Age-based: archive/delete entities older than retention_days
 * trigger_condition: { date_field?: "created_at" | "updated_at" }
 */
async function processAgePolicy(policy: repo.LifecyclePolicy): Promise<number> {
  if (!policy.retention_days) return 0

  const dateField = policy.trigger_condition.date_field ?? 'updated_at'
  const safeField = dateField === 'created_at' ? 'created_at' : 'updated_at'

  const result = await query<{ id: string }>(
    `SELECT e.id FROM entities e
     JOIN entity_types et ON et.id = e.entity_type_id
     WHERE et.name = $1 AND e.container_id = $2
       AND e.${safeField} < NOW() - ($3 || ' days')::INTERVAL
       AND e.status != 'archived'
     LIMIT 1000`,
    [policy.entity_type, policy.container_id, String(policy.retention_days)],
  )

  for (const row of result.rows) {
    await applyAction(row.id, policy.action)
  }

  return result.rows.length
}

/**
 * Status-based: when entity reaches a specific status, apply action
 * trigger_condition: { status: "approved", after_days?: 30 }
 */
async function processStatusPolicy(policy: repo.LifecyclePolicy): Promise<number> {
  const { status, after_days } = policy.trigger_condition
  if (!status) return 0

  let timeCondition = ''
  const params: any[] = [policy.entity_type, policy.container_id, status]

  if (after_days) {
    timeCondition = `AND e.updated_at < NOW() - ($4 || ' days')::INTERVAL`
    params.push(String(after_days))
  }

  const result = await query<{ id: string }>(
    `SELECT e.id FROM entities e
     JOIN entity_types et ON et.id = e.entity_type_id
     WHERE et.name = $1 AND e.container_id = $2 AND e.status = $3
       ${timeCondition}
     LIMIT 1000`,
    params,
  )

  for (const row of result.rows) {
    await applyAction(row.id, policy.action)
  }

  return result.rows.length
}

async function applyAction(entityId: string, action: repo.LifecyclePolicy['action']): Promise<void> {
  switch (action) {
    case 'archive':
    case 'soft_delete':
      await query(
        `UPDATE entities SET status = 'archived', updated_at = NOW() WHERE id = $1`,
        [entityId],
      )
      break
    case 'hard_delete':
      await query('DELETE FROM entities WHERE id = $1', [entityId])
      break
    case 'export':
      // TODO: export entity content to S3 before archiving
      await query(
        `UPDATE entities SET status = 'archived', updated_at = NOW() WHERE id = $1`,
        [entityId],
      )
      break
  }
}

/**
 * Manual archive/restore for single entities (API-triggered)
 */
export async function archiveEntity(entityId: string): Promise<void> {
  await query(
    `UPDATE entities SET status = 'archived', updated_at = NOW() WHERE id = $1`,
    [entityId],
  )
}

export async function restoreEntity(entityId: string): Promise<void> {
  await query(
    `UPDATE entities SET status = 'draft', updated_at = NOW() WHERE id = $1`,
    [entityId],
  )
}
