import { For, Show } from 'solid-js'
import { useStore } from '@nanostores/solid'
import { $formData } from '../stores/ui'

export function RadioGroup(props: { label?: string; options: string[]; bind?: string; direction?: string }) {
  const formData = useStore($formData)

  const value = () => props.bind ? (formData()[props.bind] ?? '') : ''

  const select = (opt: string) => {
    if (props.bind) $formData.setKey(props.bind, opt)
  }

  const isHorizontal = () => props.direction === 'horizontal'

  return (
    <div class="flex flex-col gap-2" role="radiogroup">
      <Show when={props.label}>
        <span class="text-sm font-medium" style={{ color: 'var(--ui-text-secondary)' }}>{props.label}</span>
      </Show>
      <div class="flex gap-3" classList={{ "flex-col": !isHorizontal() }}>
        <For each={props.options}>
          {(opt) => {
            const selected = () => opt === value()
            return (
              <div
                class="inline-flex items-center gap-2.5 cursor-pointer select-none py-0.5"
                role="radio"
                aria-checked={selected()}
                tabIndex={0}
                onClick={() => select(opt)}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); select(opt) } }}
              >
                <span
                  class="relative flex items-center justify-center shrink-0 rounded-full transition-all duration-150"
                  style={{
                    width: '18px',
                    height: '18px',
                    border: selected() ? '2px solid var(--ui-primary)' : '2px solid var(--ui-text-muted)',
                    "box-shadow": selected() ? '0 0 0 2px color-mix(in srgb, var(--ui-primary) 20%, transparent)' : 'none',
                  }}
                >
                  <span
                    class="rounded-full transition-all duration-150"
                    style={{
                      width: selected() ? '8px' : '0px',
                      height: selected() ? '8px' : '0px',
                      "background-color": 'var(--ui-primary)',
                      opacity: selected() ? '1' : '0',
                    }}
                  />
                </span>
                <span class="text-sm" style={{ color: 'var(--ui-text)' }}>{opt}</span>
              </div>
            )
          }}
        </For>
      </div>
    </div>
  )
}
