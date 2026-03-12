import { useStore } from '@nanostores/solid'
import { $manifestSummary } from '../stores/manifest'

/** Header: "5/39 reviewed" — reacts to schema generation progress */
export function HeaderReviewCount(props: { initial: string }) {
  const summary = useStore($manifestSummary)
  const text = () => {
    const s = summary()
    return s.total > 0 ? `${s.reviewed}/${s.total} reviewed` : props.initial
  }
  return <span class="text-[10px]" style={{ color: 'var(--ui-text-muted)' }}>{text()}</span>
}

/** Header: Manifest tab "(39)" count */
export function HeaderManifestCount(props: { initial: number }) {
  const summary = useStore($manifestSummary)
  const count = () => summary().total || props.initial
  return <span class="ml-1.5 text-[10px] tabular-nums">({count()})</span>
}

/** Sidebar: progress bar + "5/39" count */
export function SidebarProgress(props: { initialReady: number; initialTotal: number }) {
  const summary = useStore($manifestSummary)
  const total = () => summary().total || props.initialTotal
  const ready = () => summary().ready || props.initialReady
  const pct = () => total() > 0 ? `${(ready() / total()) * 100}%` : '0%'

  return (
    <div class="flex items-center gap-1.5 mt-1">
      <div class="h-1 rounded-full flex-1" style={{ 'background-color': 'rgba(240,237,232,0.06)' }}>
        <div
          class="h-1 rounded-full transition-all"
          style={{ 'background-color': 'var(--ui-primary)', width: pct() }}
        />
      </div>
      <span class="text-[10px] tabular-nums" style={{ color: 'var(--ui-text-muted)' }}>
        {ready()}/{total()}
      </span>
    </div>
  )
}
