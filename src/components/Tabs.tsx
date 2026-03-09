import { createSignal, For, Show } from 'solid-js'
import type { JSX } from 'solid-js'

export function Tabs(props: { tabs: { label: string; value: string }[]; children?: JSX.Element }) {
  const [active, setActive] = createSignal(props.tabs[0]?.value ?? '')
  const children = () => Array.isArray(props.children) ? props.children : props.children ? [props.children] : []
  return (
    <div>
      <div class="flex gap-1 border-b" style={{ "border-color": "var(--ui-border)" }}>
        <For each={props.tabs}>{(tab) => (
          <button
            class="px-4 py-2 text-sm font-medium border-b-2 -mb-px"
            style={{ color: active() === tab.value ? "var(--ui-text)" : "var(--ui-text-muted)", "border-color": active() === tab.value ? "var(--ui-ring)" : "transparent" }}
            onClick={() => setActive(tab.value)}
          >{tab.label}</button>
        )}</For>
      </div>
      <div class="pt-4">
        <For each={props.tabs}>{(tab, i) => (
          <Show when={active() === tab.value}>{children()[i()]}</Show>
        )}</For>
      </div>
    </div>
  )
}
