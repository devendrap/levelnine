import { Show } from 'solid-js'
import type { JSX } from 'solid-js'

export function Dialog(props: { title: string; open?: boolean; children?: JSX.Element }) {
  return (
    <Show when={props.open !== false}>
      <div class="fixed inset-0 z-50 flex items-center justify-center" style={{ "background-color": "rgba(0,0,0,0.5)" }}>
        <div class="rounded-xl border p-6 shadow-lg w-full max-w-md mx-4" style={{ "background-color": "var(--ui-bg)", "border-color": "var(--ui-border)" }}>
          <h2 class="text-lg font-semibold mb-4" style={{ color: "var(--ui-text)" }}>{props.title}</h2>
          {props.children}
        </div>
      </div>
    </Show>
  )
}
