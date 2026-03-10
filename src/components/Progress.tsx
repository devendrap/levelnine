import { Show } from 'solid-js'

export function Progress(props: { value: number; label?: string }) {
  const pct = () => Math.min(100, Math.max(0, props.value))

  return (
    <div class="w-full space-y-1.5">
      <Show when={props.label}>
        <div class="flex justify-between text-sm">
          <span class="font-medium" style={{ color: "var(--ui-text-secondary)" }}>{props.label}</span>
          <span style={{ color: "var(--ui-text-muted)" }}>{pct()}%</span>
        </div>
      </Show>
      <div class="h-2.5 rounded-full overflow-hidden" style={{ "background-color": "var(--ui-bg-muted)" }}>
        <div
          class="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct()}%`,
            "background-color": pct() === 100 ? "var(--ui-success)" : "var(--ui-primary)",
          }}
        />
      </div>
    </div>
  )
}
