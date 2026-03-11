/**
 * Runtime Enforcement — Step 7 of manifest-to-app bridge
 *
 * Three enforcement layers applied at entity CRUD time:
 * 1. Role access — check restricted_entity_types
 * 2. Workflow transitions — validate status changes against state machines
 * 3. Data schema validation — validate entity content against data_schema
 */

import { query } from '../../db/index'

// ============================================================================
// 1. Role-Based Entity Type Access
// ============================================================================

export interface AccessCheckResult {
  allowed: boolean
  reason?: string
}

/**
 * Check if a role can access a given entity type in a container.
 * Uses inverted access model: roles have full access by default,
 * only explicit restrictions deny access.
 */
export async function checkRoleAccess(
  containerId: string,
  roleName: string,
  entityTypeName: string,
): Promise<AccessCheckResult> {
  const result = await query<{ restricted_entity_types: any }>(
    'SELECT restricted_entity_types FROM container_roles WHERE container_id = $1 AND name = $2 AND is_active = true',
    [containerId, roleName],
  )

  if (result.rows.length === 0) {
    // Role not found in container — allow by default (platform admin, etc.)
    return { allowed: true }
  }

  const restrictions = result.rows[0].restricted_entity_types
  if (!restrictions || !Array.isArray(restrictions) || restrictions.length === 0) {
    return { allowed: true }
  }

  // Check if this entity type is in the restriction list
  const restricted = restrictions.find((r: any) => {
    const typeName = typeof r === 'string' ? r : r.type
    return typeName === entityTypeName
  })

  if (restricted) {
    const justification = typeof restricted === 'object' ? restricted.justification : undefined
    return {
      allowed: false,
      reason: justification ?? `Role "${roleName}" is restricted from accessing "${entityTypeName}"`,
    }
  }

  return { allowed: true }
}

// ============================================================================
// 2. Workflow Transition Enforcement
// ============================================================================

export interface TransitionCheckResult {
  allowed: boolean
  reason?: string
  available_transitions?: Array<{ to: string; role?: string; conditions?: string }>
}

/**
 * Validate a status transition against the container's workflow state machine.
 * Returns allowed=true if:
 *  - No workflow defined for this entity type (no enforcement)
 *  - The transition from→to exists and the role is permitted
 */
export async function checkWorkflowTransition(
  containerId: string,
  entityTypeName: string,
  fromStatus: string,
  toStatus: string,
  userRole?: string,
): Promise<TransitionCheckResult> {
  const result = await query<{ statuses: any; transitions: any; name: string }>(
    'SELECT name, statuses, transitions FROM container_workflows WHERE container_id = $1 AND entity_type = $2 AND is_active = true',
    [containerId, entityTypeName],
  )

  if (result.rows.length === 0) {
    // No workflow defined — allow any transition
    return { allowed: true }
  }

  const workflow = result.rows[0]
  const transitions: Array<{ from: string; to: string; role?: string; conditions?: string }> =
    Array.isArray(workflow.transitions) ? workflow.transitions : []

  // Find valid transitions from current status
  const fromTransitions = transitions.filter(t => t.from === fromStatus)
  if (fromTransitions.length === 0) {
    return {
      allowed: false,
      reason: `No transitions defined from status "${fromStatus}" in workflow "${workflow.name}"`,
      available_transitions: [],
    }
  }

  // Check if the specific from→to transition exists
  const matchingTransition = fromTransitions.find(t => t.to === toStatus)
  if (!matchingTransition) {
    return {
      allowed: false,
      reason: `Cannot transition from "${fromStatus}" to "${toStatus}" in workflow "${workflow.name}"`,
      available_transitions: fromTransitions,
    }
  }

  // Check role gate (if transition specifies a required role)
  if (matchingTransition.role && userRole && matchingTransition.role !== userRole) {
    // Allow if user role is higher in hierarchy: admin > editor > viewer
    const hierarchy: Record<string, number> = { viewer: 1, editor: 2, admin: 3 }
    const userLevel = hierarchy[userRole] ?? 0
    const requiredLevel = hierarchy[matchingTransition.role] ?? 0

    if (userLevel < requiredLevel) {
      return {
        allowed: false,
        reason: `Transition "${fromStatus}" → "${toStatus}" requires role "${matchingTransition.role}" (you are "${userRole}")`,
        available_transitions: fromTransitions.filter(t => {
          if (!t.role) return true
          return (hierarchy[userRole] ?? 0) >= (hierarchy[t.role] ?? 0)
        }),
      }
    }
  }

  return { allowed: true }
}

/**
 * Get the full workflow definition for an entity type, including available
 * transitions from a given status filtered by user role.
 */
export async function getWorkflowInfo(
  containerId: string,
  entityTypeName: string,
  currentStatus?: string,
  userRole?: string,
): Promise<{
  hasWorkflow: boolean
  name?: string
  statuses?: string[]
  transitions?: Array<{ to: string; role?: string; conditions?: string; allowed: boolean; reason?: string }>
}> {
  const result = await query<{ statuses: any; transitions: any; name: string }>(
    'SELECT name, statuses, transitions FROM container_workflows WHERE container_id = $1 AND entity_type = $2 AND is_active = true',
    [containerId, entityTypeName],
  )

  if (result.rows.length === 0) {
    return { hasWorkflow: false }
  }

  const workflow = result.rows[0]
  const statuses: string[] = Array.isArray(workflow.statuses) ? workflow.statuses : []
  const transitions: Array<{ from: string; to: string; role?: string; conditions?: string }> =
    Array.isArray(workflow.transitions) ? workflow.transitions : []

  if (!currentStatus) {
    return { hasWorkflow: true, name: workflow.name, statuses }
  }

  // Get transitions from current status, annotated with role access
  const hierarchy: Record<string, number> = { viewer: 1, editor: 2, admin: 3 }
  const userLevel = hierarchy[userRole ?? ''] ?? 0

  const available = transitions
    .filter(t => t.from === currentStatus)
    .map(t => {
      const requiredLevel = hierarchy[t.role ?? ''] ?? 0
      const allowed = !t.role || userLevel >= requiredLevel
      return {
        to: t.to,
        role: t.role,
        conditions: t.conditions,
        allowed,
        reason: !allowed ? `Requires ${t.role} role` : undefined,
      }
    })

  return { hasWorkflow: true, name: workflow.name, statuses, transitions: available }
}

// ============================================================================
// 3. Data Schema Validation
// ============================================================================

export interface DataValidationResult {
  valid: boolean
  errors: Array<{ field: string; message: string }>
}

/**
 * Validate entity content against the entity type's data_schema (JSON Schema).
 * Lightweight validation — checks required fields, types, and enum constraints.
 * Does NOT use a full JSON Schema validator to avoid dependency.
 */
export function validateDataSchema(
  content: Record<string, any>,
  dataSchema: Record<string, any>,
): DataValidationResult {
  const errors: Array<{ field: string; message: string }> = []

  if (!dataSchema || dataSchema.type !== 'object' || !dataSchema.properties) {
    return { valid: true, errors: [] }
  }

  const properties = dataSchema.properties as Record<string, any>
  const required = new Set<string>(Array.isArray(dataSchema.required) ? dataSchema.required : [])

  // Check required fields
  for (const field of required) {
    if (content[field] === undefined || content[field] === null || content[field] === '') {
      errors.push({ field, message: `"${field}" is required` })
    }
  }

  // Check types and enum constraints for provided fields
  for (const [field, value] of Object.entries(content)) {
    const prop = properties[field]
    if (!prop) continue // extra fields are allowed

    if (value === null || value === undefined) continue // null is ok for non-required

    // Type check
    if (prop.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value
      if (prop.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) {
        errors.push({ field, message: `"${field}" must be an integer` })
      } else if (prop.type === 'number' && typeof value !== 'number') {
        errors.push({ field, message: `"${field}" must be a number` })
      } else if (prop.type === 'string' && typeof value !== 'string') {
        errors.push({ field, message: `"${field}" must be a string` })
      } else if (prop.type === 'boolean' && typeof value !== 'boolean') {
        errors.push({ field, message: `"${field}" must be a boolean` })
      } else if (prop.type === 'array' && !Array.isArray(value)) {
        errors.push({ field, message: `"${field}" must be an array` })
      }
    }

    // Enum constraint
    if (prop.enum && Array.isArray(prop.enum) && !prop.enum.includes(value)) {
      errors.push({ field, message: `"${field}" must be one of: ${prop.enum.join(', ')}` })
    }
  }

  return { valid: errors.length === 0, errors }
}
