export function Separator(props: { orientation?: string }) {
  return props.orientation === 'vertical'
    ? <div class="w-px bg-gray-200 self-stretch" />
    : <hr class="border-gray-200" />
}
