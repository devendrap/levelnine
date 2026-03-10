import { createSignal, Show } from 'solid-js'

export default function AppLoginIsland(props: { slug: string; appName: string }) {
  const [mode, setMode] = createSignal<'login' | 'register'>('login')
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [name, setName] = createSignal('')
  const [error, setError] = createSignal('')
  const [loading, setLoading] = createSignal(false)

  const submit = async (e: Event) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const endpoint = mode() === 'login'
      ? `/api/v1/apps/${props.slug}/auth/login`
      : `/api/v1/apps/${props.slug}/auth/register`

    const body = mode() === 'login'
      ? { email: email(), password: password() }
      : { email: email(), password: password(), name: name() }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Authentication failed')
        return
      }
      window.location.href = `/apps/${props.slug}`
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      class="min-h-screen flex items-center justify-center"
      style={{ 'background-color': 'var(--ui-bg)', 'font-family': 'var(--ui-font)' }}
    >
      <div
        class="w-full max-w-sm p-8 rounded-xl"
        style={{ 'background-color': 'var(--ui-card-bg)', 'box-shadow': 'var(--ui-shadow-lg)', border: '1px solid var(--ui-border)' }}
      >
        <div class="mb-8 text-center">
          <div
            class="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center text-lg font-bold"
            style={{ 'background-color': 'rgba(212,164,74,0.12)', color: 'var(--ui-primary)' }}
          >
            {props.appName.charAt(0).toUpperCase()}
          </div>
          <h1 class="text-xl font-semibold mb-1" style={{ color: 'var(--ui-text)' }}>{props.appName}</h1>
          <p class="text-sm" style={{ color: 'var(--ui-text-muted)' }}>
            {mode() === 'login' ? 'Sign in to continue' : 'Create your account'}
          </p>
        </div>

        <Show when={error()}>
          <div
            class="mb-4 px-3 py-2 rounded-lg text-sm"
            style={{ 'background-color': 'var(--ui-error-bg)', color: 'var(--ui-error)', border: '1px solid var(--ui-error-border)' }}
          >
            {error()}
          </div>
        </Show>

        <form onSubmit={submit} class="flex flex-col gap-4">
          <Show when={mode() === 'register'}>
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium" style={{ color: 'var(--ui-text)' }}>Name</label>
              <input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="Your name"
                required={mode() === 'register'}
                class="px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{ 'background-color': 'var(--ui-bg-muted)', color: 'var(--ui-text)', border: '1px solid var(--ui-border)' }}
              />
            </div>
          </Show>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium" style={{ color: 'var(--ui-text)' }}>Email</label>
            <input
              type="email"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              placeholder="you@company.com"
              required
              class="px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{ 'background-color': 'var(--ui-bg-muted)', color: 'var(--ui-text)', border: '1px solid var(--ui-border)' }}
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium" style={{ color: 'var(--ui-text)' }}>Password</label>
            <input
              type="password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              placeholder="••••••••"
              required
              class="px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{ 'background-color': 'var(--ui-bg-muted)', color: 'var(--ui-text)', border: '1px solid var(--ui-border)' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading()}
            class="mt-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ 'background-color': 'var(--ui-primary)', color: '#0B0F1A', 'box-shadow': 'var(--ui-shadow)' }}
          >
            {loading() ? (mode() === 'login' ? 'Signing in...' : 'Creating account...') : (mode() === 'login' ? 'Sign in' : 'Create account')}
          </button>
        </form>

        <div class="mt-6 text-center">
          <button
            type="button"
            onClick={() => { setMode(mode() === 'login' ? 'register' : 'login'); setError('') }}
            class="text-sm cursor-pointer hover:underline"
            style={{ color: 'var(--ui-primary)', background: 'none', border: 'none' }}
          >
            {mode() === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
