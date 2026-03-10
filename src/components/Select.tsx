import { Show, For, createSignal, onCleanup, onMount } from 'solid-js'
import { useStore } from '@nanostores/solid'
import { $formData } from '../stores/ui'

export function Select(props: { label?: string; options: string[]; placeholder?: string; bind?: string }) {
  const formData = useStore($formData)
  const [open, setOpen] = createSignal(false)
  const [focusIdx, setFocusIdx] = createSignal(-1)
  let triggerRef!: HTMLButtonElement
  let listRef!: HTMLDivElement

  const value = () => props.bind ? (formData()[props.bind] ?? '') : ''

  const select = (opt: string) => {
    if (props.bind) $formData.setKey(props.bind, opt)
    setOpen(false)
    triggerRef?.focus()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const opts = props.options
    if (!open()) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setFocusIdx(Math.max(0, opts.indexOf(value())))
        setOpen(true)
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setFocusIdx(i => Math.min(i + 1, opts.length - 1)); break
      case 'ArrowUp': e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)); break
      case 'Enter': case ' ': e.preventDefault(); if (focusIdx() >= 0) select(opts[focusIdx()]); break
      case 'Escape': e.preventDefault(); setOpen(false); triggerRef?.focus(); break
    }
  }

  // Close on outside click
  const handleClickOutside = (e: MouseEvent) => {
    if (open() && triggerRef && !triggerRef.contains(e.target as Node) && listRef && !listRef.contains(e.target as Node)) {
      setOpen(false)
    }
  }
  onMount(() => document.addEventListener('mousedown', handleClickOutside))
  onCleanup(() => document.removeEventListener('mousedown', handleClickOutside))

  return (
    <div class="flex flex-col gap-1.5 relative" onKeyDown={onKeyDown}>
      <Show when={props.label}>
        <label class="text-sm font-medium" style={{ color: 'var(--ui-text-secondary)' }}>
          {props.label}
        </label>
      </Show>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open()}
        aria-haspopup="listbox"
        class="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-all duration-150 cursor-pointer"
        style={{
          "background-color": 'var(--ui-bg)',
          "border-color": open() ? 'var(--ui-primary)' : 'var(--ui-border)',
          color: value() ? 'var(--ui-text)' : 'var(--ui-text-placeholder)',
          "box-shadow": open() ? '0 0 0 3px color-mix(in srgb, var(--ui-primary) 15%, transparent)' : 'var(--ui-shadow)',
          "min-height": '40px',
        }}
        onClick={() => { setOpen(!open()); if (!open()) setFocusIdx(Math.max(0, props.options.indexOf(value()))) }}
      >
        <span class="truncate">{value() || props.placeholder || 'Select an option...'}</span>
        <svg
          viewBox="0 0 16 16"
          fill="none"
          style={{
            width: '16px',
            height: '16px',
            color: 'var(--ui-text-muted)',
            transition: 'transform 200ms',
            transform: open() ? 'rotate(180deg)' : 'rotate(0deg)',
            "flex-shrink": '0',
            "margin-left": '8px',
          }}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <Show when={open()}>
        <div
          ref={listRef}
          role="listbox"
          class="absolute top-full left-0 right-0 mt-1 rounded-lg border overflow-hidden z-50"
          style={{
            "background-color": 'var(--ui-card-bg)',
            "border-color": 'var(--ui-border)',
            "box-shadow": 'var(--ui-shadow-lg)',
            animation: 'ui-slide-down 150ms ease-out',
          }}
        >
          <div class="py-1 max-h-56 overflow-auto">
            <For each={props.options}>
              {(opt, i) => (
                <div
                  role="option"
                  aria-selected={opt === value()}
                  class="flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer transition-colors duration-75"
                  style={{
                    color: 'var(--ui-text)',
                    "background-color": focusIdx() === i() ? 'var(--ui-bg-muted)' : opt === value() ? 'var(--ui-bg-subtle)' : 'transparent',
                  }}
                  onMouseEnter={() => setFocusIdx(i())}
                  onMouseDown={(e) => { e.preventDefault(); select(opt) }}
                >
                  <span class="flex-1">{opt}</span>
                  <Show when={opt === value()}>
                    <svg viewBox="0 0 16 16" fill="none" style={{ width: '16px', height: '16px', color: 'var(--ui-primary)', "flex-shrink": '0' }}>
                      <path d="M3.5 8L6.5 11L12.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}
