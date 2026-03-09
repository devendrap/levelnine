import { For } from 'solid-js'
import { Dynamic } from 'solid-js/web'

export function List(props: { items: string[]; ordered?: boolean }) {
  const tag = () => props.ordered ? 'ol' : 'ul'
  return (
    <Dynamic component={tag()} class={`text-gray-700 text-sm space-y-1 pl-5 ${props.ordered ? 'list-decimal' : 'list-disc'}`}>
      <For each={props.items}>{(item) => <li>{item}</li>}</For>
    </Dynamic>
  )
}
