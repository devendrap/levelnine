import { Show } from 'solid-js'

export function Progress(props: { value: number; label?: string }) {
  return (
    <div class="w-full space-y-1">
      <Show when={props.label}>
        <div class="flex justify-between text-sm">
          <span style={{ color: "var(--ui-text-secondary)" }}>{props.label}</span>
          <span style={{ color: "var(--ui-text-muted)" }}>{props.value}%</span>
        </div>
      </Show>
      <div class="h-2 rounded-full overflow-hidden" style={{ "background-color": "var(--ui-bg-muted)" }}>
        <div class="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, props.value))}%`, "background-color": "var(--ui-ring)" }} />
      </div>
    </div>
  )
}
