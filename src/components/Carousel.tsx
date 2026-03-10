import { createSignal, For, Show, onCleanup } from 'solid-js'

export function Carousel(props: { slides: { content: string; caption?: string }[]; autoplay?: boolean; interval?: number }) {
  const [current, setCurrent] = createSignal(0)
  const total = () => props.slides.length

  const next = () => setCurrent(i => (i + 1) % total())
  const prev = () => setCurrent(i => (i - 1 + total()) % total())
  const goTo = (idx: number) => setCurrent(idx)

  // Autoplay
  let timer: ReturnType<typeof setInterval> | undefined
  if (props.autoplay !== false) {
    timer = setInterval(next, (props.interval ?? 5) * 1000)
  }
  onCleanup(() => { if (timer) clearInterval(timer) })

  // Keyboard
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') prev()
    else if (e.key === 'ArrowRight') next()
  }

  return (
    <div
      class="relative rounded-xl border overflow-hidden select-none"
      style={{ "border-color": 'var(--ui-border)', "background-color": 'var(--ui-bg)' }}
      tabIndex={0}
      onKeyDown={onKeyDown}
      role="region"
      aria-roledescription="carousel"
      aria-label="Carousel"
    >
      {/* Slides */}
      <div class="relative overflow-hidden" style={{ "min-height": '280px' }}>
        <For each={props.slides}>
          {(slide, i) => (
            <div
              class="absolute inset-0 flex flex-col items-center justify-center p-8 transition-all duration-500"
              style={{
                opacity: current() === i() ? '1' : '0',
                transform: current() === i() ? 'translateX(0)' : current() > i() ? 'translateX(-100%)' : 'translateX(100%)',
                "pointer-events": current() === i() ? 'auto' : 'none',
              }}
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${i() + 1} of ${total()}`}
            >
              <Show
                when={slide.content.match(/^https?:\/\/.*\.(jpg|jpeg|png|gif|webp|svg|avif)/i) || slide.content.match(/^https?:\/\/(images\.|.*unsplash\.com)/)}
                fallback={
                  <>
                    <p class="text-base text-center leading-relaxed" style={{ color: 'var(--ui-text)' }}>{slide.content}</p>
                    <Show when={slide.caption}>
                      <p class="text-xs mt-3" style={{ color: 'var(--ui-text-muted)' }}>{slide.caption}</p>
                    </Show>
                  </>
                }
              >
                <img
                  src={slide.content}
                  alt={slide.caption ?? ''}
                  class="w-full h-full object-cover absolute inset-0"
                />
                <Show when={slide.caption}>
                  <div class="absolute bottom-0 left-0 right-0 p-3 text-xs text-center" style={{ color: '#F0EDE8', "background": 'linear-gradient(transparent, rgba(11,15,26,0.8))' }}>
                    {slide.caption}
                  </div>
                </Show>
              </Show>
            </div>
          )}
        </For>
      </div>

      {/* Nav arrows */}
      <Show when={total() > 1}>
        <button
          type="button"
          class="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-100"
          style={{
            width: '32px',
            height: '32px',
            "background-color": 'var(--ui-bg)',
            "box-shadow": 'var(--ui-shadow)',
            color: 'var(--ui-text-muted)',
            opacity: '0.7',
            border: '1px solid var(--ui-border)',
          }}
          onClick={prev}
          aria-label="Previous slide"
        >
          <svg viewBox="0 0 16 16" fill="none" style={{ width: '14px', height: '14px' }}>
            <path d="M10 4l-4 4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full cursor-pointer transition-opacity hover:opacity-100"
          style={{
            width: '32px',
            height: '32px',
            "background-color": 'var(--ui-bg)',
            "box-shadow": 'var(--ui-shadow)',
            color: 'var(--ui-text-muted)',
            opacity: '0.7',
            border: '1px solid var(--ui-border)',
          }}
          onClick={next}
          aria-label="Next slide"
        >
          <svg viewBox="0 0 16 16" fill="none" style={{ width: '14px', height: '14px' }}>
            <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </Show>

      {/* Dots */}
      <Show when={total() > 1}>
        <div class="flex items-center justify-center gap-1.5 py-3">
          <For each={props.slides}>
            {(_, i) => (
              <button
                type="button"
                class="rounded-full cursor-pointer transition-all duration-200"
                style={{
                  width: current() === i() ? '20px' : '8px',
                  height: '8px',
                  "background-color": current() === i() ? 'var(--ui-primary)' : 'var(--ui-bg-muted)',
                }}
                onClick={() => goTo(i())}
                aria-label={`Go to slide ${i() + 1}`}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
