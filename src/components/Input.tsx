import { Show } from 'solid-js'

export function Input(props: { label?: string; placeholder?: string; type?: string; required?: boolean }) {
  return (
    <div class="flex flex-col gap-1.5">
      <Show when={props.label}>
        <label class="text-sm font-medium text-gray-700">
          {props.label}{props.required && <span class="text-red-500 ml-0.5">*</span>}
        </label>
      </Show>
      <input
        type={props.type ?? 'text'}
        placeholder={props.placeholder}
        required={props.required}
        class="rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
      />
    </div>
  )
}
