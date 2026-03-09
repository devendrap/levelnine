import { Show } from 'solid-js'
import type { JSX } from 'solid-js'

export function Card(props: { title?: string; description?: string; children?: JSX.Element }) {
  return (
    <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <Show when={props.title}><h3 class="font-semibold text-lg text-gray-900">{props.title}</h3></Show>
      <Show when={props.description}><p class="text-2xl font-bold text-gray-900 mt-1">{props.description}</p></Show>
      {props.children}
    </div>
  )
}
