import { Show, For, createSignal, createMemo, onMount, onCleanup } from 'solid-js'
import { useStore } from '@nanostores/solid'
import { $formData } from '../stores/ui'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function pad(n: number) { return n < 10 ? '0' + n : '' + n }
function toISO(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}` }
function parseISO(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}

export function DatePicker(props: { label?: string; bind?: string; required?: boolean; min?: string; max?: string }) {
  const formData = useStore($formData)
  const [open, setOpen] = createSignal(false)

  const value = () => props.bind ? (formData()[props.bind] ?? '') : ''

  const today = new Date()
  const initDate = () => {
    const v = value()
    if (v) { const p = parseISO(v); return { year: p.year, month: p.month } }
    return { year: today.getFullYear(), month: today.getMonth() }
  }
  const [viewYear, setViewYear] = createSignal(initDate().year)
  const [viewMonth, setViewMonth] = createSignal(initDate().month)

  let containerRef!: HTMLDivElement

  const handleClickOutside = (e: MouseEvent) => {
    if (open() && containerRef && !containerRef.contains(e.target as Node)) setOpen(false)
  }
  onMount(() => document.addEventListener('mousedown', handleClickOutside))
  onCleanup(() => document.removeEventListener('mousedown', handleClickOutside))

  const calendarDays = createMemo(() => {
    const year = viewYear(), month = viewMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrev = new Date(year, month, 0).getDate()
    const cells: { day: number; current: boolean; iso: string }[] = []
    // Previous month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrev - i
      const m = month === 0 ? 11 : month - 1
      const y = month === 0 ? year - 1 : year
      cells.push({ day: d, current: false, iso: toISO(y, m, d) })
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, current: true, iso: toISO(year, month, d) })
    }
    // Next month padding
    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 0 : month + 1
      const y = month === 11 ? year + 1 : year
      cells.push({ day: d, current: false, iso: toISO(y, m, d) })
    }
    return cells
  })

  const isDisabled = (iso: string) => {
    if (props.min && iso < props.min) return true
    if (props.max && iso > props.max) return true
    return false
  }

  const selectDate = (iso: string) => {
    if (isDisabled(iso)) return
    if (props.bind) $formData.setKey(props.bind, iso)
    setOpen(false)
  }

  const prevMonth = () => {
    if (viewMonth() === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth() === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const goToday = () => {
    const t = new Date()
    setViewYear(t.getFullYear())
    setViewMonth(t.getMonth())
  }

  const displayValue = () => {
    const v = value()
    if (!v) return ''
    const p = parseISO(v)
    return `${MONTHS[p.month]} ${p.day}, ${p.year}`
  }

  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate())

  return (
    <div class="flex flex-col gap-1.5 relative" ref={containerRef}>
      <Show when={props.label}>
        <label class="text-sm font-medium" style={{ color: 'var(--ui-text-secondary)' }}>
          {props.label}{props.required && <span style={{ color: 'var(--ui-error)', "margin-left": '2px' }}>*</span>}
        </label>
      </Show>
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all duration-150 cursor-pointer"
        style={{
          "background-color": 'var(--ui-bg)',
          "border-color": open() ? 'var(--ui-primary)' : 'var(--ui-border)',
          color: value() ? 'var(--ui-text)' : 'var(--ui-text-placeholder)',
          "box-shadow": open() ? '0 0 0 3px color-mix(in srgb, var(--ui-primary) 15%, transparent)' : 'var(--ui-shadow)',
          "min-height": '40px',
        }}
        onClick={() => {
          if (!open()) {
            const d = initDate()
            setViewYear(d.year)
            setViewMonth(d.month)
          }
          setOpen(!open())
        }}
      >
        {/* Calendar icon */}
        <svg viewBox="0 0 20 20" fill="none" style={{ width: '16px', height: '16px', color: 'var(--ui-text-muted)', "flex-shrink": '0' }}>
          <rect x="3" y="4" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5" />
          <path d="M3 8h14" stroke="currentColor" stroke-width="1.5" />
          <path d="M7 2v4M13 2v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <span class="flex-1 text-left truncate">{displayValue() || 'Pick a date...'}</span>
      </button>

      <Show when={open()}>
        <div
          class="absolute top-full left-0 mt-1 rounded-xl border z-50 select-none"
          style={{
            "background-color": 'var(--ui-card-bg)',
            "border-color": 'var(--ui-border)',
            "box-shadow": 'var(--ui-shadow-lg)',
            width: '296px',
            animation: 'ui-scale-in 150ms ease-out',
          }}
        >
          {/* Header */}
          <div class="flex items-center justify-between px-4 py-3" style={{ "border-bottom": '1px solid var(--ui-border)' }}>
            <button
              type="button"
              class="flex items-center justify-center rounded-md transition-colors cursor-pointer hover:opacity-70"
              style={{ width: '28px', height: '28px', color: 'var(--ui-text-muted)' }}
              onClick={prevMonth}
            >
              <svg viewBox="0 0 16 16" fill="none" style={{ width: '14px', height: '14px' }}>
                <path d="M10 4l-4 4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              class="text-sm font-semibold cursor-pointer hover:opacity-70 transition-opacity"
              style={{ color: 'var(--ui-text)' }}
              onClick={goToday}
            >
              {MONTHS[viewMonth()]} {viewYear()}
            </button>
            <button
              type="button"
              class="flex items-center justify-center rounded-md transition-colors cursor-pointer hover:opacity-70"
              style={{ width: '28px', height: '28px', color: 'var(--ui-text-muted)' }}
              onClick={nextMonth}
            >
              <svg viewBox="0 0 16 16" fill="none" style={{ width: '14px', height: '14px' }}>
                <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div class="grid grid-cols-7 px-3 pt-2">
            <For each={DAYS}>
              {(d) => (
                <div
                  class="flex items-center justify-center text-xs font-medium py-1"
                  style={{ color: 'var(--ui-text-muted)', height: '32px' }}
                >{d}</div>
              )}
            </For>
          </div>

          {/* Day grid */}
          <div class="grid grid-cols-7 px-3 pb-3">
            <For each={calendarDays()}>
              {(cell) => {
                const selected = () => cell.iso === value()
                const isToday = () => cell.iso === todayISO
                const disabled = () => isDisabled(cell.iso)
                return (
                  <button
                    type="button"
                    disabled={disabled()}
                    class="flex items-center justify-center text-sm rounded-lg transition-all duration-100 cursor-pointer"
                    style={{
                      width: '36px',
                      height: '36px',
                      margin: '1px auto',
                      "font-weight": selected() || isToday() ? '600' : '400',
                      color: disabled()
                        ? 'var(--ui-text-placeholder)'
                        : selected()
                          ? 'white'
                          : cell.current
                            ? 'var(--ui-text)'
                            : 'var(--ui-text-placeholder)',
                      "background-color": selected() ? 'var(--ui-primary)' : 'transparent',
                      border: isToday() && !selected() ? '1px solid var(--ui-primary)' : '1px solid transparent',
                      opacity: disabled() ? '0.4' : '1',
                    }}
                    onClick={() => selectDate(cell.iso)}
                  >
                    {cell.day}
                  </button>
                )
              }}
            </For>
          </div>

          {/* Footer */}
          <div
            class="flex items-center justify-between px-4 py-2.5 text-xs"
            style={{ "border-top": '1px solid var(--ui-border)', color: 'var(--ui-text-muted)' }}
          >
            <button
              type="button"
              class="cursor-pointer hover:opacity-70 transition-opacity font-medium"
              style={{ color: 'var(--ui-primary)' }}
              onClick={() => { selectDate(todayISO) }}
            >Today</button>
            <Show when={value()}>
              <button
                type="button"
                class="cursor-pointer hover:opacity-70 transition-opacity"
                onClick={() => { if (props.bind) $formData.setKey(props.bind, ''); setOpen(false) }}
              >Clear</button>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
