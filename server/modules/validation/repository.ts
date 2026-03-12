import { query } from '../../db/index'

export interface ValidationRule {
  id: string
  container_id: string
  entity_type: string
  rule_name: string
  rule_type: 'field' | 'cross_field' | 'cross_entity'
  expression: Record<string, any>
  error_message: string
  severity: 'error' | 'warning'
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export async function findByContainerAndType(
  containerId: string,
  entityType: string,
): Promise<ValidationRule[]> {
  const result = await query<ValidationRule>(
    `SELECT * FROM sys_validation_rules
     WHERE container_id = $1 AND entity_type = $2 AND is_active = true
     ORDER BY rule_name`,
    [containerId, entityType],
  )
  return result.rows
}

export async function insertRule(data: {
  container_id: string
  entity_type: string
  rule_name: string
  rule_type: ValidationRule['rule_type']
  expression: Record<string, any>
  error_message: string
  severity?: ValidationRule['severity']
}): Promise<ValidationRule> {
  const result = await query<ValidationRule>(
    `INSERT INTO sys_validation_rules (container_id, entity_type, rule_name, rule_type, expression, error_message, severity)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (container_id, entity_type, rule_name) DO UPDATE SET
       rule_type = EXCLUDED.rule_type, expression = EXCLUDED.expression,
       error_message = EXCLUDED.error_message, severity = EXCLUDED.severity
     RETURNING *`,
    [data.container_id, data.entity_type, data.rule_name, data.rule_type,
     JSON.stringify(data.expression), data.error_message, data.severity ?? 'error'],
  )
  return result.rows[0]
}

export async function deleteRule(id: string): Promise<void> {
  await query('DELETE FROM sys_validation_rules WHERE id = $1', [id])
}
