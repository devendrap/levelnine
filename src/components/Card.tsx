import { Show } from 'solid-js'
import type { JSX } from 'solid-js'

export function Card(props: { title?: string; description?: string; children?: JSX.Element }) {
  return (
    <div
      class="rounded-xl border p-6"
      style={{
        "background-color": "var(--ui-card-bg)",
        "border-color": "var(--ui-border)",
        "box-shadow": "var(--ui-shadow)",
      }}
    >
      <Show when={props.title || props.description}>
        <div class="mb-4" classList={{ "mb-4": !!props.children }}>
          <Show when={props.title}><h3 class="font-semibold text-lg" style={{ color: "var(--ui-text)" }}>{props.title}</h3></Show>
          <Show when={props.description}><p class="text-sm mt-1" style={{ color: "var(--ui-text-muted)" }}>{props.description}</p></Show>
        </div>
      </Show>
      {props.children}
    </div>
  )
}
