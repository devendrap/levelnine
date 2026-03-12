import { query } from '../../db/index'
import { notifyRole } from './service'
import * as security from '../security/service'

/**
 * D9→C2 bridge: Match audit log events against container notification rules
 * and enqueue notifications for matching recipients.
 *
 * Called after entity changes (create/update/delete/status_change).
 */
export async function triggerNotifications(event: {
  container_id: string
  entity_id: string
  entity_type: string
  entity_name: string
  action: 'create' | 'update' | 'delete' | 'status_change'
  field_changes?: Record<string, any>
  new_values?: Record<string, any>
}): Promise<void> {
  // Map action to trigger_event values from D9 rules
  const triggerEvents = mapActionToTriggerEvents(event.action)

  // Find matching notification rules for this container + entity type
  const rules = await query<{
    name: string
    trigger_event: string
    trigger_condition: string | null
    recipients: string[]
    channel: string
    template: string | null
    escalation_minutes: number | null
    escalation_to: string | null
  }>(
    `SELECT name, trigger_event, trigger_condition, recipients, channel, template,
            escalation_minutes, escalation_to
     FROM cfg_notifications
     WHERE container_id = $1
       AND trigger_entity_type = $2
       AND trigger_event = ANY($3)`,
    [event.container_id, event.entity_type, triggerEvents],
  )

  // Pre-load security classifications for masking notification content
  const classifications = await security.getClassifications(event.container_id, event.entity_type)

  for (const rule of rules.rows) {
    // Check trigger condition if specified
    if (rule.trigger_condition && !evaluateCondition(rule.trigger_condition, event)) {
      continue
    }

    // Send to each recipient role — mask values per role
    for (const role of rule.recipients) {
      // Mask new_values based on recipient role's security classification
      const maskedEvent = { ...event }
      if (classifications.length > 0 && maskedEvent.new_values) {
        maskedEvent.new_values = security.maskContent(maskedEvent.new_values, classifications, role)
      }

      const body = interpolateTemplate(
        rule.template ?? `{{entity_type}} "{{entity_name}}" — ${event.action}`,
        maskedEvent,
      )

      await notifyRole({
        container_id: event.container_id,
        role,
        channel: rule.channel as 'email' | 'in_app' | 'both',
        subject: `${event.entity_type}: ${event.entity_name}`,
        body,
        payload: { rule: rule.name, entity_id: event.entity_id, action: event.action },
        entity_id: event.entity_id,
      })
    }
  }
}

function mapActionToTriggerEvents(action: string): string[] {
  switch (action) {
    case 'create': return ['created']
    case 'update': return ['updated', 'field_change']
    case 'status_change': return ['status_change']
    case 'delete': return ['updated'] // treat delete as an update event
    default: return [action]
  }
}

/**
 * Evaluate simple trigger conditions like "status == 'pending_approval'"
 */
function evaluateCondition(condition: string, event: Record<string, any>): boolean {
  const match = condition.match(/^(\w+)\s*(==|!=)\s*'([^']*)'$/)
  if (!match) {
    console.warn(`[trigger] Unparseable condition: "${condition}" — skipping rule`)
    return false // unparseable conditions should NOT pass through
  }

  const [, field, op, value] = match

  // Prevent prototype pollution — only allow simple alphanumeric field names
  if (field.startsWith('__') || field === 'constructor' || field === 'prototype') {
    return false
  }

  const actual = event.new_values?.[field] ?? event.field_changes?.[field]

  if (op === '==') return actual === value
  if (op === '!=') return actual !== value
  return false
}

/**
 * Replace {{var}} placeholders in notification templates.
 */
function interpolateTemplate(template: string, event: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key === 'entity_name') return event.entity_name ?? ''
    if (key === 'entity_type') return event.entity_type ?? ''
    if (key === 'action') return event.action ?? ''
    // Look in new_values for field references
    if (event.new_values?.[key] !== undefined) return String(event.new_values[key])
    return `{{${key}}}`
  })
}
