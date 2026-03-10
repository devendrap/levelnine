import { Show, createSignal } from 'solid-js'
import { useStore } from '@nanostores/solid'
import { $formData } from '../stores/ui'

export function Textarea(props: { label?: string; placeholder?: string; rows?: number; required?: boolean; bind?: string }) {
  const formData = useStore($formData)
  const [focused, setFocused] = createSignal(false)

  const val = () => props.bind ? (formData()[props.bind] ?? '') : ''

  return (
    <div class="flex flex-col gap-1.5">
      <Show when={props.label}>
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium" style={{ color: 'var(--ui-text-secondary)' }}>
            {props.label}{props.required && <span style={{ color: 'var(--ui-error)', "margin-left": '2px' }}>*</span>}
          </label>
        </div>
      </Show>
      <div
        class="rounded-lg border transition-all duration-150 overflow-hidden"
        style={{
          "border-color": focused() ? 'var(--ui-primary)' : 'var(--ui-border)',
          "box-shadow": focused() ? '0 0 0 3px color-mix(in srgb, var(--ui-primary) 15%, transparent)' : 'none',
          "background-color": 'var(--ui-bg)',
        }}
      >
        <textarea
          placeholder={props.placeholder}
          required={props.required}
          rows={props.rows ?? 3}
          value={val()}
          onInput={(e) => props.bind && $formData.setKey(props.bind, e.currentTarget.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          class="w-full px-3 py-2.5 text-sm resize-y border-none outline-none"
          style={{
            "background-color": 'transparent',
            color: 'var(--ui-text)',
            "min-height": `${Math.max(3, props.rows ?? 3) * 24 + 20}px`,
          }}
        />
      </div>
    </div>
  )
}
