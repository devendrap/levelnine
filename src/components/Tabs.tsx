import { createSignal, For, Show, children as resolveChildren } from 'solid-js'
import type { JSX } from 'solid-js'

export function Tabs(props: {
  tabs: { label: string; value?: string }[]
  children?: JSX.Element
}) {
  const resolved = () =>
    props.tabs.map((t) => ({
      label: t.label,
      value: t.value ?? t.label,
    }))

  const [active, setActive] = createSignal(resolved()[0]?.value ?? '')

  const panels = resolveChildren(() => props.children)
  const panelArray = () => {
    const c = panels()
    return Array.isArray(c) ? c : c ? [c] : []
  }

  return (
    <div>
      <div class="flex gap-0.5 border-b" style={{ "border-color": "var(--ui-border)" }}>
        <For each={resolved()}>
          {(tab) => {
            const isActive = () => active() === tab.value
            return (
              <button
                class="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all duration-150 cursor-pointer"
                style={{
                  color: isActive() ? "var(--ui-primary)" : "var(--ui-text-muted)",
                  "border-color": isActive() ? "var(--ui-primary)" : "transparent",
                  "background-color": isActive() ? "var(--ui-primary-subtle)" : "transparent",
                  "border-radius": "var(--ui-radius-md) var(--ui-radius-md) 0 0",
                }}
                onClick={() => setActive(tab.value)}
              >
                {tab.label}
              </button>
            )
          }}
        </For>
      </div>
      <div class="pt-4">
        <For each={resolved()}>
          {(tab, i) => (
            <Show when={active() === tab.value}>{panelArray()[i()]}</Show>
          )}
        </For>
      </div>
    </div>
  )
}
