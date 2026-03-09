import { Show } from 'solid-js'
import { useStore } from '@nanostores/solid'
import { $formData } from '../stores/ui'

export function Input(props: { label?: string; placeholder?: string; type?: string; required?: boolean; bind?: string }) {
  const formData = useStore($formData)

  return (
    <div class="flex flex-col gap-1.5">
      <Show when={props.label}>
        <label class="text-sm font-medium" style={{ color: "var(--ui-text-secondary)" }}>
          {props.label}{props.required && <span class="text-red-500 ml-0.5">*</span>}
        </label>
      </Show>
      <input
        type={props.type ?? 'text'}
        placeholder={props.placeholder}
        required={props.required}
        value={props.bind ? (formData()[props.bind] ?? '') : ''}
        onInput={(e) => props.bind && $formData.setKey(props.bind, e.currentTarget.value)}
        class="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
        style={{
          "background-color": "var(--ui-bg)",
          "border-color": "var(--ui-border)",
          color: "var(--ui-text)",
          "--tw-ring-color": "var(--ui-ring)",
        }}
      />
    </div>
  )
}
