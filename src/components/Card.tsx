import { Show } from 'solid-js'
import type { JSX } from 'solid-js'

export function Card(props: { title?: string; description?: string; children?: JSX.Element }) {
  return (
    <div class="rounded-xl border p-6 shadow-sm" style={{ "background-color": "var(--ui-bg)", "border-color": "var(--ui-border)" }}>
      <Show when={props.title}><h3 class="font-semibold text-lg" style={{ color: "var(--ui-text)" }}>{props.title}</h3></Show>
      <Show when={props.description}><p class="text-2xl font-bold mt-1" style={{ color: "var(--ui-text)" }}>{props.description}</p></Show>
      {props.children}
    </div>
  )
}
