import type { JSX } from 'solid-js'

export function Stack(props: { gap?: string; children?: JSX.Element }) {
  return (
    <div class="flex flex-col" style={{ gap: `${Number(props.gap ?? 4) * 0.25}rem` }}>
      {props.children}
    </div>
  )
}
