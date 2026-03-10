import { useStore } from '@nanostores/solid'
import { $formData } from '../stores/ui'

export function Checkbox(props: { label: string; bind?: string; defaultChecked?: boolean }) {
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
      class="group inline-flex items-center gap-3 cursor-pointer select-none py-1"
      style={{ color: 'var(--ui-text)' }}
      role="checkbox"
      aria-checked={checked()}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={onKeyDown}
    >
      <span
        class="relative flex items-center justify-center shrink-0 rounded transition-all duration-150"
        style={{
          width: '18px',
          height: '18px',
          "background-color": checked() ? 'var(--ui-primary)' : 'transparent',
          "border": checked() ? '2px solid var(--ui-primary)' : '2px solid var(--ui-text-muted)',
          "box-shadow": checked() ? '0 0 0 2px color-mix(in srgb, var(--ui-primary) 20%, transparent)' : 'none',
        }}
      >
        <svg
          viewBox="0 0 12 12"
          fill="none"
          style={{
            width: '10px',
            height: '10px',
            opacity: checked() ? 1 : 0,
            transition: 'opacity 100ms',
          }}
        >
          <path
            d="M2.5 6L5 8.5L9.5 3.5"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            style={{
              "stroke-dasharray": '16',
              "stroke-dashoffset": checked() ? '0' : '16',
              transition: 'stroke-dashoffset 200ms ease-out',
            }}
          />
        </svg>
      </span>
      <span class="text-sm leading-none">{props.label}</span>
    </div>
  )
}
