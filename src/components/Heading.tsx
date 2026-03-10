import { Dynamic } from 'solid-js/web'

const sizes: Record<number, string> = {
  1: 'font-bold',
  2: 'font-bold',
  3: 'font-semibold',
  4: 'font-semibold',
  5: 'font-medium',
  6: 'font-medium',
}

const fontSizes: Record<number, string> = {
  1: 'var(--ui-font-size-h1)',
  2: 'var(--ui-font-size-h2)',
  3: 'var(--ui-font-size-h3)',
  4: 'var(--ui-font-size-h4)',
  5: '15px',
  6: 'var(--ui-font-size-body)',
}

export function Heading(props: { level: number; content?: string; text?: string }) {
  const resolved = () => props.content ?? props.text ?? ''
  return (
    <Dynamic
      component={`h${props.level}` as any}
      class={sizes[props.level] ?? sizes[1]}
      style={{
        color: "var(--ui-text)",
        "font-size": fontSizes[props.level] ?? fontSizes[1],
        "line-height": "1.3",
      }}
    >
      {resolved()}
    </Dynamic>
  )
}
