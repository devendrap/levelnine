import { For } from 'solid-js'

export function Skeleton(props: { lines?: number; height?: string; variant?: string }) {
  const variant = () => props.variant ?? 'text'
  const lines = () => props.lines ?? 3

  if (variant() === 'avatar') {
    return (
      <div
        class="rounded-full animate-pulse"
        style={{
          width: props.height ?? '40px',
          height: props.height ?? '40px',
          "background-color": 'var(--ui-bg-muted)',
        }}
      />
    )
  }

  if (variant() === 'card') {
    return (
      <div
        class="rounded-xl border p-6 space-y-4"
        style={{ "border-color": 'var(--ui-border)', "background-color": 'var(--ui-bg)' }}
      >
        <div class="animate-pulse rounded-md" style={{ height: '20px', width: '40%', "background-color": 'var(--ui-bg-muted)' }} />
        <div class="space-y-2">
          <div class="animate-pulse rounded-md" style={{ height: '14px', width: '100%', "background-color": 'var(--ui-bg-muted)' }} />
          <div class="animate-pulse rounded-md" style={{ height: '14px', width: '80%', "background-color": 'var(--ui-bg-muted)' }} />
          <div class="animate-pulse rounded-md" style={{ height: '14px', width: '60%', "background-color": 'var(--ui-bg-muted)' }} />
        </div>
      </div>
    )
  }

  // Default: text lines
  return (
    <div class="space-y-2.5">
      <For each={Array.from({ length: lines() })}>
        {(_, i) => (
          <div
            class="animate-pulse rounded-md"
            style={{
              height: props.height ?? '14px',
              width: i() === lines() - 1 ? '60%' : '100%',
              "background-color": 'var(--ui-bg-muted)',
            }}
          />
        )}
      </For>
    </div>
  )
}
