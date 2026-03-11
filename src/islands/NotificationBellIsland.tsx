import { createSignal, onMount, onCleanup, Show, For } from 'solid-js'

interface Notification {
  id: string
  subject: string
  body: string
  status: string
  created_at: string
  entity_id?: string
}

export default function NotificationBellIsland() {
  const [unread, setUnread] = createSignal(0)
  const [notifications, setNotifications] = createSignal<Notification[]>([])
  const [open, setOpen] = createSignal(false)

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/v1/notifications?pageSize=10')
      if (!res.ok) return
      const data = await res.json()
      setUnread(data.unread ?? 0)
      setNotifications(data.data ?? [])
    } catch { /* silent */ }
  }

  const markRead = async (id: string) => {
    try {
      await fetch(`/api/v1/notifications/${id}/read`, { method: 'POST' })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'read' } : n))
      setUnread(prev => Math.max(0, prev - 1))
    } catch { /* silent */ }
  }

  onMount(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    onCleanup(() => clearInterval(interval))
  })

  // Close on outside click
  let containerRef: HTMLDivElement | undefined
  const handleClick = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) setOpen(false)
  }
  onMount(() => {
    document.addEventListener('click', handleClick)
    onCleanup(() => document.removeEventListener('click', handleClick))
  })

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div class="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open())}
        class="relative p-1.5 rounded-lg cursor-pointer transition-all hover:opacity-80"
        style={{ background: 'none', border: 'none', color: 'var(--ui-text-muted)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <Show when={unread() > 0}>
          <span
            class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold"
            style={{ 'background-color': 'var(--ui-error, #EF4444)', color: 'white' }}
          >
            {unread() > 9 ? '9+' : unread()}
          </span>
        </Show>
      </button>

      <Show when={open()}>
        <div
          class="absolute right-0 top-10 w-80 rounded-xl overflow-hidden z-50"
          style={{
            'background-color': 'var(--ui-card-bg, var(--ui-bg-subtle))',
            border: '1px solid var(--ui-border)',
            'box-shadow': '0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          <div
            class="flex items-center justify-between px-4 py-3"
            style={{ 'border-bottom': '1px solid var(--ui-border)' }}
          >
            <span class="text-xs font-semibold" style={{ color: 'var(--ui-text)' }}>Notifications</span>
            <Show when={unread() > 0}>
              <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ 'background-color': 'rgba(239,68,68,0.1)', color: 'var(--ui-error)' }}>
                {unread()} unread
              </span>
            </Show>
          </div>

          <div class="max-h-80 overflow-y-auto">
            <Show
              when={notifications().length > 0}
              fallback={
                <div class="px-4 py-8 text-center text-xs" style={{ color: 'var(--ui-text-muted)' }}>
                  No notifications yet
                </div>
              }
            >
              <For each={notifications()}>
                {(n) => (
                  <div
                    class="px-4 py-3 cursor-pointer transition-colors"
                    style={{
                      'border-bottom': '1px solid var(--ui-border)',
                      'background-color': n.status !== 'read' ? 'rgba(212,164,74,0.04)' : 'transparent',
                    }}
                    onClick={() => n.status !== 'read' && markRead(n.id)}
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                          <Show when={n.status !== 'read'}>
                            <span class="w-1.5 h-1.5 rounded-full shrink-0" style={{ 'background-color': 'var(--ui-primary)' }} />
                          </Show>
                          <span class="text-xs font-medium truncate" style={{ color: 'var(--ui-text)' }}>
                            {n.subject}
                          </span>
                        </div>
                        <p class="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'var(--ui-text-muted)' }}>
                          {n.body}
                        </p>
                      </div>
                      <span class="text-[10px] shrink-0" style={{ color: 'var(--ui-text-placeholder)' }}>
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
