import type { JSX } from 'solid-js'

const alignMap: Record<string, string> = {
  start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch',
}
const justifyMap: Record<string, string> = {
  start: 'justify-start', center: 'justify-center', end: 'justify-end', between: 'justify-between',
}

export function Row(props: { gap?: string; align?: string; justify?: string; children?: JSX.Element }) {
  return (
    <div
      class={`flex flex-row ${alignMap[props.align ?? 'start']} ${justifyMap[props.justify ?? 'start']}`}
      style={{ gap: `${Number(props.gap ?? 4) * 0.25}rem` }}
    >
      {props.children}
    </div>
  )
}
