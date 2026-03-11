import * as repo from './repository'

export interface ValidationResult {
  rule_name: string
  severity: 'error' | 'warning'
  message: string
  field?: string
}

/**
 * Run all active validation rules for an entity before save.
 * Returns array of violations (empty = valid).
 */
export async function validate(
  containerId: string,
  entityType: string,
  content: Record<string, any>,
): Promise<ValidationResult[]> {
  const rules = await repo.findByContainerAndType(containerId, entityType)
  const results: ValidationResult[] = []

  for (const rule of rules) {
    const violation = evaluateRule(rule, content)
    if (violation) results.push(violation)
  }

  return results
}

function evaluateRule(
  rule: repo.ValidationRule,
  content: Record<string, any>,
): ValidationResult | null {
  const expr = rule.expression

  switch (rule.rule_type) {
    case 'field':
      return evaluateFieldRule(rule, expr, content)
    case 'cross_field':
      return evaluateCrossFieldRule(rule, expr, content)
    case 'cross_entity':
      // Cross-entity validation not yet implemented — return warning so it's visible
      return {
        rule_name: rule.rule_name,
        severity: 'warning' as const,
        message: `Rule "${rule.rule_name}" uses cross_entity validation which is not yet implemented`,
      }
    default:
      return null
  }
}

/**
 * Field rule: { field, op, value?, ref_field? }
 * Operators: required, gt, gte, lt, lte, eq, neq, in, regex, min_length, max_length
 */
function evaluateFieldRule(
  rule: repo.ValidationRule,
  expr: Record<string, any>,
  content: Record<string, any>,
): ValidationResult | null {
  const { field, op, value, ref_field } = expr
  const fieldVal = content[field]
  const compareVal = ref_field ? content[ref_field] : value

  let failed = false

  switch (op) {
    case 'required':
      failed = fieldVal === undefined || fieldVal === null || fieldVal === ''
      break
    case 'gt':
      failed = !(fieldVal > compareVal)
      break
    case 'gte':
      failed = !(fieldVal >= compareVal)
      break
    case 'lt':
      failed = !(fieldVal < compareVal)
      break
    case 'lte':
      failed = !(fieldVal <= compareVal)
      break
    case 'eq':
      failed = fieldVal !== compareVal
      break
    case 'neq':
      failed = fieldVal === compareVal
      break
    case 'in':
      failed = !Array.isArray(value) || !value.includes(fieldVal)
      break
    case 'regex':
      failed = typeof fieldVal !== 'string' || !new RegExp(value).test(fieldVal)
      break
    case 'min_length':
      failed = typeof fieldVal !== 'string' || fieldVal.length < value
      break
    case 'max_length':
      failed = typeof fieldVal !== 'string' || fieldVal.length > value
      break
  }

  if (failed) {
    return {
      rule_name: rule.rule_name,
      severity: rule.severity,
      message: rule.error_message,
      field,
    }
  }
  return null
}

/**
 * Cross-field rule: { condition: "if_then", if_field, if_value, then_field, then_op, then_value? }
 * Example: if status=approved then approver_id required
 */
function evaluateCrossFieldRule(
  rule: repo.ValidationRule,
  expr: Record<string, any>,
  content: Record<string, any>,
): ValidationResult | null {
  const { condition } = expr

  if (condition === 'if_then') {
    const { if_field, if_value, then_field, then_op, then_value } = expr
    const ifMatch = content[if_field] === if_value
    if (!ifMatch) return null // condition not met, rule doesn't apply

    // Evaluate the "then" part as a field rule
    const thenResult = evaluateFieldRule(rule, {
      field: then_field,
      op: then_op,
      value: then_value,
    }, content)
    return thenResult
  }

  return null
}
