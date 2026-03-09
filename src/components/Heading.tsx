import { Dynamic } from 'solid-js/web'

const sizes: Record<number, string> = {
  1: 'text-4xl font-bold',
  2: 'text-3xl font-semibold',
  3: 'text-2xl font-semibold',
  4: 'text-xl font-medium',
  5: 'text-lg font-medium',
  6: 'text-base font-medium',
}

export function Heading(props: { level: number; content: string }) {
  return (
    <Dynamic component={`h${props.level}` as any} class={sizes[props.level] ?? sizes[1]} style={{ color: "var(--ui-text)" }}>
      {props.content}
    </Dynamic>
  )
}
