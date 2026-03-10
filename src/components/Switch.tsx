import { useStore } from '@nanostores/solid'
import { $formData } from '../stores/ui'

export function Switch(props: { label: string; bind?: string; defaultChecked?: boolean }) {
  const formData = useStore($formData)

  const checked = () => {
    if (!props.bind) return props.defaultChecked ?? false
    const val = formData()[props.bind]
    if (val === undefined) return props.defaultChecked ?? false
    return val === 'true'
  }

  const toggle = () => {
    if (props.bind) $formData.setKey(props.bind, String(!checked()))
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle() }
  }

  return (
    <div
      class="inline-flex items-center gap-3 cursor-pointer select-none py-1"
      role="switch"
      aria-checked={checked()}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={onKeyDown}
    >
      <span
        class="relative inline-flex shrink-0 rounded-full transition-colors duration-200"
        style={{
          width: '40px',
          height: '22px',
          "background-color": checked() ? 'var(--ui-primary)' : 'var(--ui-bg-muted)',
          "box-shadow": checked()
            ? '0 0 0 2px color-mix(in srgb, var(--ui-primary) 20%, transparent)'
            : 'inset 0 1px 2px rgba(0,0,0,.1)',
        }}
      >
        <span
          class="absolute top-[2px] rounded-full bg-white transition-all duration-200 shadow-sm"
          style={{
            width: '18px',
            height: '18px',
            left: checked() ? '20px' : '2px',
          }}
        />
      </span>
      <span class="text-sm" style={{ color: 'var(--ui-text)' }}>{props.label}</span>
    </div>
  )
}
