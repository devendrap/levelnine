import { createSignal, Show } from 'solid-js'

export function Image(props: { src: string; alt: string; width?: string; height?: string; rounded?: string; caption?: string }) {
  const [loaded, setLoaded] = createSignal(false)
  const [errored, setErrored] = createSignal(false)

  const borderRadius = () => {
    const r = props.rounded ?? 'md'
    const map: Record<string, string> = { none: '0', sm: '4px', md: '8px', lg: '12px', xl: '16px', full: '9999px' }
    return map[r] ?? r
  }

  return (
    <figure class="flex flex-col gap-2">
      <div
        class="relative overflow-hidden"
        style={{
          "border-radius": borderRadius(),
          width: props.width ?? '100%',
          height: props.height ?? 'auto',
          "background-color": 'var(--ui-bg-muted)',
        }}
      >
        {/* Loading skeleton */}
        <Show when={!loaded() && !errored()}>
          <div
            class="absolute inset-0 animate-pulse"
            style={{ "background-color": 'var(--ui-bg-muted)' }}
          />
        </Show>

        {/* Error state */}
        <Show when={errored()}>
          <div
            class="flex flex-col items-center justify-center gap-2 p-6"
            style={{ color: 'var(--ui-text-muted)', "min-height": props.height ?? '120px' }}
          >
            <svg viewBox="0 0 24 24" fill="none" style={{ width: '24px', height: '24px' }}>
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5" />
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
              <path d="M21 15l-5-5-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span class="text-xs">Failed to load image</span>
          </div>
        </Show>

        {/* Image */}
        <img
          src={props.src}
          alt={props.alt}
          class="transition-opacity duration-300"
          style={{
            width: '100%',
            height: props.height ?? 'auto',
            "object-fit": 'cover',
            opacity: loaded() ? '1' : '0',
            display: errored() ? 'none' : 'block',
            "border-radius": borderRadius(),
          }}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      </div>

      <Show when={props.caption}>
        <figcaption class="text-xs text-center" style={{ color: 'var(--ui-text-muted)' }}>
          {props.caption}
        </figcaption>
      </Show>
    </figure>
  )
}
