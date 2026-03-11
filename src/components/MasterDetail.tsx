import { Show, children as resolveChildren } from 'solid-js'

export function MasterDetail(props: {
  splitRatio?: string
  minLeftWidth?: string
  collapsible?: boolean
  children?: any
}) {
  const ratio = () => props.splitRatio ?? '40/60'
  const [left, right] = (() => {
    const parts = ratio().split('/')
    return [parseInt(parts[0]) || 40, parseInt(parts[1]) || 60]
  })()

  const resolved = resolveChildren(() => props.children)

  const panels = () => {
    const r = resolved()
    if (Array.isArray(r)) return r
    return r ? [r] : []
  }

  const leftPanel = () => panels()[0]
  const rightPanel = () => panels()[1]

  return (
    <div
      class="flex h-full overflow-hidden rounded-lg border"
      style={{
        'border-color': 'var(--ui-border)',
        'background-color': 'var(--ui-card-bg)',
      }}
    >
      {/* Left panel — grid */}
      <div
        class="flex flex-col overflow-hidden"
        style={{
          width: `${left}%`,
          'min-width': props.minLeftWidth ?? '200px',
          'border-right': '1px solid var(--ui-border)',
        }}
      >
        <Show when={leftPanel()}>
          {leftPanel()}
        </Show>
      </div>

      {/* Right panel — detail */}
      <div
        class="flex-1 flex flex-col overflow-auto"
        style={{ width: `${right}%` }}
      >
        <Show
          when={rightPanel()}
          fallback={
            <div
              class="flex-1 flex items-center justify-center text-xs"
              style={{ color: 'var(--ui-text-muted)' }}
            >
              Select an item to view details
            </div>
          }
        >
          {rightPanel()}
        </Show>
      </div>
    </div>
  )
}
