import { Show, createSignal } from 'solid-js'
import { useStore } from '@nanostores/solid'
import { $formData } from '../stores/ui'

export function Input(props: { label?: string; placeholder?: string; type?: string; required?: boolean; bind?: string; disabled?: boolean }) {
  const formData = useStore($formData)
  const [focused, setFocused] = createSignal(false)

  return (
    <div class="flex flex-col gap-1.5">
      <Show when={props.label}>
        <label class="text-sm font-medium" style={{ color: "var(--ui-text-secondary)" }}>
          {props.label}{props.required && <span style={{ color: "var(--ui-error)", "margin-left": "2px" }}>*</span>}
        </label>
      </Show>
      <div
        class="rounded-lg border transition-all duration-150 overflow-hidden"
        style={{
          "border-color": focused() ? "var(--ui-primary)" : "var(--ui-border)",
          "box-shadow": focused() ? "0 0 0 3px color-mix(in srgb, var(--ui-primary) 15%, transparent)" : "var(--ui-shadow)",
          "background-color": "var(--ui-bg)",
        }}
      >
        <input
          type={props.type ?? 'text'}
          placeholder={props.placeholder}
          required={props.required}
          value={props.bind ? (formData()[props.bind] ?? '') : ''}
          onInput={(e) => props.bind && !props.disabled && $formData.setKey(props.bind, e.currentTarget.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={props.disabled}
          class="w-full px-3 py-2.5 text-sm border-none outline-none"
          style={{
            "background-color": "transparent",
            color: "var(--ui-text)",
          }}
        />
      </div>
    </div>
  )
}
