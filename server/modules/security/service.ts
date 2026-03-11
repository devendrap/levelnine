import { query } from '../../db/index'

export interface DataClassification {
  id: string
  container_id: string
  entity_type: string
  field_path: string
  classification: 'public' | 'internal' | 'confidential' | 'pii'
  mask_for_roles: string[]
  created_at: Date
  updated_at: Date
}

/**
 * Get all classifications for an entity type in a container.
 */
export async function getClassifications(
  containerId: string,
  entityType: string,
): Promise<DataClassification[]> {
  const result = await query<DataClassification>(
    `SELECT * FROM data_classifications WHERE container_id = $1 AND entity_type = $2`,
    [containerId, entityType],
  )
  return result.rows
}

/**
 * Upsert a field classification.
 */
export async function classifyField(data: {
  container_id: string
  entity_type: string
  field_path: string
  classification: DataClassification['classification']
  mask_for_roles?: string[]
}): Promise<DataClassification> {
  const result = await query<DataClassification>(
    `INSERT INTO data_classifications (container_id, entity_type, field_path, classification, mask_for_roles)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (container_id, entity_type, field_path) DO UPDATE SET
       classification = EXCLUDED.classification, mask_for_roles = EXCLUDED.mask_for_roles
     RETURNING *`,
    [data.container_id, data.entity_type, data.field_path,
     data.classification, JSON.stringify(data.mask_for_roles ?? [])],
  )
  return result.rows[0]
}

/**
 * Apply field masking to entity content based on user role.
 * Returns a new content object with sensitive fields masked.
 */
export function maskContent(
  content: Record<string, any>,
  classifications: DataClassification[],
  userRole: string,
): Record<string, any> {
  if (classifications.length === 0) return content

  const masked = { ...content }

  for (const cls of classifications) {
    const roles = cls.mask_for_roles as string[]
    if (roles.length > 0 && roles.includes(userRole)) {
      const parts = cls.field_path.split('.')
      maskNestedField(masked, parts, cls.classification)
    }
  }

  return masked
}

function maskNestedField(
  obj: Record<string, any>,
  path: string[],
  classification: string,
): void {
  if (path.length === 0) return

  const [head, ...rest] = path

  if (rest.length === 0) {
    // Leaf — mask the value
    if (head in obj && obj[head] !== null && obj[head] !== undefined) {
      const original = String(obj[head])
      if (classification === 'pii') {
        // PII: show first/last char with asterisks
        obj[head] = original.length > 2
          ? original[0] + '***' + original[original.length - 1]
          : '***'
      } else {
        // confidential/internal: full mask
        obj[head] = '●●●●●●'
      }
    }
  } else if (typeof obj[head] === 'object' && obj[head] !== null) {
    maskNestedField(obj[head], rest, classification)
  }
}
