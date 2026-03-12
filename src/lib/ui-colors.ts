/**
 * Shared status badge color maps — used across Sidebar, ContainerHeader, and widgets.
 * Single source of truth to avoid duplication.
 */

const containerStatusColors: Record<string, { bg: string; fg: string }> = {
  draft: { bg: 'rgba(240,237,232,0.08)', fg: 'var(--ui-text-muted)' },
  review: { bg: 'rgba(228,168,50,0.12)', fg: '#E4A832' },
  locked: { bg: 'rgba(34,197,94,0.12)', fg: '#22C55E' },
}

/** Returns inline style string for container status badges (draft/review/locked) */
export function statusBadgeStyle(status: string): string {
  const c = containerStatusColors[status] ?? containerStatusColors.draft
  return `background-color:${c.bg};color:${c.fg}`
}

const entityStatusColors: Record<string, { bg: string; fg: string }> = {
  approved: { bg: 'var(--ui-success-bg)', fg: 'var(--ui-success)' },
  review: { bg: 'var(--ui-warning-bg)', fg: 'var(--ui-warning)' },
  archived: { bg: 'var(--ui-error-bg)', fg: 'var(--ui-error)' },
}

const defaultEntityStatus = { bg: 'rgba(240,237,232,0.06)', fg: 'var(--ui-text-muted)' }

/** Returns inline style string for entity status badges (approved/review/archived/draft) */
export function entityStatusBadgeStyle(status: string): string {
  const c = entityStatusColors[status] ?? defaultEntityStatus
  return `background-color:${c.bg};color:${c.fg}`
}
