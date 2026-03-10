import { createSignal, Show } from 'solid-js'

export default function SidebarCreateForm() {
  const [creating, setCreating] = createSignal(false)
  const [name, setName] = createSignal('')

  const create = async () => {
    const n = name().trim()
    if (!n) return
    const res = await fetch('/api/v1/containers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n }),
    })
    if (res.ok) {
      const c = await res.json()
      setName('')
      setCreating(false)
      window.location.href = `/containers/${c.id}`
    }
  }

  return (
    <>
      <Show when={creating()}>
        <div class="px-2 py-2">
          <input
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="Container name..."
            class="w-full px-3 py-2.5 rounded-lg text-sm border outline-none"
            style={{
              "background-color": "rgba(240,237,232,0.04)",
              "border-color": "var(--ui-border)",
              color: "var(--ui-text)",
            }}
            autofocus
          />
          <div class="flex gap-2 mt-2">
            <button
              onClick={create}
              class="flex-1 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer"
              style={{ "background-color": "var(--ui-primary)", color: "#0B0F1A" }}
            >
              Create
            </button>
            <button
              onClick={() => setCreating(false)}
              class="flex-1 px-3 py-2 rounded-lg text-xs cursor-pointer"
              style={{ color: "var(--ui-text-muted)", "background-color": "rgba(240,237,232,0.04)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>
      <Show when={!creating()}>
        <button
          onClick={() => setCreating(true)}
          class="w-full px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all hover:opacity-90"
          style={{
            "background-color": "rgba(212,164,74,0.08)",
            color: "var(--ui-primary)",
            border: "1px solid rgba(212,164,74,0.15)",
          }}
        >
          + New Container
        </button>
      </Show>
    </>
  )
}
