import { createSignal, Show, For } from 'solid-js'
import Toast, { showToast } from '../components/containers/Toast'

interface DomainRole {
  name: string
  label: string
}

export default function AppInviteUserIsland(props: {
  slug: string
  domainRoles: DomainRole[]
}) {
  const [open, setOpen] = createSignal(false)
  const [submitting, setSubmitting] = createSignal(false)

  const submit = async (e: Event) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    const body = {
      email: fd.get('email'),
      name: fd.get('name'),
      password: fd.get('password'),
      role: fd.get('role'),
      domain_role: fd.get('domain_role') || undefined,
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/apps/${props.slug}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        showToast(`User "${body.email}" created successfully.`, 'success')
        setTimeout(() => window.location.reload(), 1000)
      } else {
        const data = await res.json()
        showToast(data.error || 'Failed to create user', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Toast />
      <button
        onClick={() => setOpen(!open())}
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
        style={{ 'background-color': 'var(--ui-primary)', color: 'var(--ui-bg)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Invite User
      </button>

      <Show when={open()}>
        <div
          class="rounded-xl p-6 mb-6"
          style={{ 'background-color': 'var(--ui-bg-subtle)', border: '1px solid var(--ui-border)' }}
        >
          <h3 class="text-sm font-semibold mb-4" style={{ color: 'var(--ui-text)' }}>Invite New User</h3>
          <form onSubmit={submit} class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium mb-1" style={{ color: 'var(--ui-text-muted)' }}>Email</label>
                <input
                  name="email"
                  type="email"
                  required
                  class="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ 'background-color': 'var(--ui-bg)', border: '1px solid var(--ui-border)', color: 'var(--ui-text)' }}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label class="block text-xs font-medium mb-1" style={{ color: 'var(--ui-text-muted)' }}>Name</label>
                <input
                  name="name"
                  type="text"
                  required
                  class="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ 'background-color': 'var(--ui-bg)', border: '1px solid var(--ui-border)', color: 'var(--ui-text)' }}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label class="block text-xs font-medium mb-1" style={{ color: 'var(--ui-text-muted)' }}>App Role</label>
                <select
                  name="role"
                  class="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ 'background-color': 'var(--ui-bg)', border: '1px solid var(--ui-border)', color: 'var(--ui-text)' }}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium mb-1" style={{ color: 'var(--ui-text-muted)' }}>Domain Role</label>
                <select
                  name="domain_role"
                  class="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ 'background-color': 'var(--ui-bg)', border: '1px solid var(--ui-border)', color: 'var(--ui-text)' }}
                >
                  <option value="">None</option>
                  <For each={props.domainRoles}>
                    {(r) => <option value={r.name}>{r.label}</option>}
                  </For>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium mb-1" style={{ color: 'var(--ui-text-muted)' }}>Temporary Password</label>
                <input
                  name="password"
                  type="text"
                  required
                  class="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ 'background-color': 'var(--ui-bg)', border: '1px solid var(--ui-border)', color: 'var(--ui-text)' }}
                  placeholder="Temp password (user changes on first login)"
                />
              </div>
            </div>
            <div class="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={submitting()}
                class="px-4 py-2 rounded-lg text-xs font-medium"
                style={{ 'background-color': 'var(--ui-primary)', color: 'var(--ui-bg)' }}
              >
                {submitting() ? 'Creating...' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                class="px-4 py-2 rounded-lg text-xs font-medium"
                style={{ color: 'var(--ui-text-muted)', border: '1px solid var(--ui-border)' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </Show>
    </>
  )
}
