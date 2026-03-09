export function Separator(props: { orientation?: string }) {
  return props.orientation === 'vertical'
    ? <div class="w-px self-stretch" style={{ "background-color": "var(--ui-border)" }} />
    : <hr style={{ "border-color": "var(--ui-border)" }} />
}
