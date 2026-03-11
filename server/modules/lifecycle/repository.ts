import { query } from '../../db/index'

export interface LifecyclePolicy {
  id: string
  container_id: string
  entity_type: string
  policy_name: string
  trigger_type: 'age' | 'status' | 'manual'
  trigger_condition: Record<string, any>
  action: 'archive' | 'soft_delete' | 'hard_delete' | 'export'
  retention_days: number | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export async function findByContainer(containerId: string): Promise<LifecyclePolicy[]> {
  const result = await query<LifecyclePolicy>(
    'SELECT * FROM lifecycle_policies WHERE container_id = $1 AND is_active = true ORDER BY entity_type',
    [containerId],
  )
  return result.rows
}

export async function findByContainerAndType(
  containerId: string,
  entityType: string,
): Promise<LifecyclePolicy[]> {
  const result = await query<LifecyclePolicy>(
    'SELECT * FROM lifecycle_policies WHERE container_id = $1 AND entity_type = $2 AND is_active = true',
    [containerId, entityType],
  )
  return result.rows
}

export async function insertPolicy(data: {
  container_id: string
  entity_type: string
  policy_name: string
  trigger_type: LifecyclePolicy['trigger_type']
  trigger_condition: Record<string, any>
  action: LifecyclePolicy['action']
  retention_days?: number
}): Promise<LifecyclePolicy> {
  const result = await query<LifecyclePolicy>(
    `INSERT INTO lifecycle_policies (container_id, entity_type, policy_name, trigger_type, trigger_condition, action, retention_days)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (container_id, entity_type, policy_name) DO UPDATE SET
       trigger_type = EXCLUDED.trigger_type, trigger_condition = EXCLUDED.trigger_condition,
       action = EXCLUDED.action, retention_days = EXCLUDED.retention_days
     RETURNING *`,
    [data.container_id, data.entity_type, data.policy_name, data.trigger_type,
     JSON.stringify(data.trigger_condition), data.action, data.retention_days ?? null],
  )
  return result.rows[0]
}

export async function deletePolicy(id: string): Promise<void> {
  await query('DELETE FROM lifecycle_policies WHERE id = $1', [id])
}
