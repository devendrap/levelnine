import { createSignal, Show, type JSX } from 'solid-js'

export function Tooltip(props: { label: string; content: string; children?: JSX.Element }) {
  const [visible, setVisible] = createSignal(false)
  let timeout: ReturnType<typeof setTimeout>

  const show = () => { clearTimeout(timeout); timeout = setTimeout(() => setVisible(true), 200) }
  const hide = () => { clearTimeout(timeout); setVisible(false) }

  return (
    <span
      class="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusIn={show}
      onFocusOut={hide}
    >
      {/* Trigger: render children or the label as an underlined hint */}
      <Show when={props.children} fallback={
        <span
          class="text-sm cursor-help border-b border-dotted"
          style={{ color: 'var(--ui-text)', "border-color": 'var(--ui-text-muted)' }}
          tabIndex={0}
        >{props.label}</span>
      }>
        {props.children}
      </Show>

      {/* Tooltip bubble */}
      <Show when={visible()}>
        <span
          class="absolute bottom-full left-1/2 mb-2 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap pointer-events-none z-50"
          style={{
            transform: 'translateX(-50%)',
            "background-color": 'var(--ui-text)',
            color: 'var(--ui-bg)',
            "box-shadow": 'var(--ui-shadow-lg)',
            animation: 'ui-slide-down 100ms ease-out',
          }}
          role="tooltip"
        >
          {props.content}
          {/* Arrow */}
          <span
            class="absolute top-full left-1/2"
            style={{
              transform: 'translateX(-50%)',
              "border-left": '5px solid transparent',
              "border-right": '5px solid transparent',
              "border-top": '5px solid var(--ui-text)',
            }}
          />
        </span>
      </Show>
    </span>
  )
}
