import { createSignal } from 'solid-js'

export default function LoginIsland() {
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [error, setError] = createSignal('')
  const [loading, setLoading] = createSignal(false)

  const submit = async (e: Event) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email(), password: password() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Login failed')
        return
      }
      // Use Astro view transitions for smooth navigation
      if ('navigate' in window) {
        (window as any).navigate('/dashboard')
      } else {
        window.location.href = '/dashboard'
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      class="min-h-screen flex items-center justify-center"
      style={{ "background-color": "var(--ui-bg)", "font-family": "var(--ui-font)" }}
    >
      <div
        class="w-full max-w-sm p-8 rounded-xl"
        style={{ "background-color": "var(--ui-card-bg)", "box-shadow": "var(--ui-shadow-lg)", border: "1px solid var(--ui-border)" }}
      >
        <div class="mb-8 text-center">
          <h1 class="text-2xl font-semibold mb-1" style={{ color: "var(--ui-text)" }}>ai-ui</h1>
          <p class="text-sm" style={{ color: "var(--ui-text-muted)" }}>Sign in to your account</p>
        </div>

        {error() && (
          <div
            class="mb-4 px-3 py-2 rounded-lg text-sm"
            style={{ "background-color": "var(--ui-error-bg)", color: "var(--ui-error)", border: "1px solid var(--ui-error-border)" }}
          >
            {error()}
          </div>
        )}

        <div
          class="mb-4 px-3 py-2.5 rounded-lg text-xs cursor-pointer"
          style={{ "background-color": "var(--ui-bg-muted)", border: "1px solid var(--ui-border)" }}
          onClick={() => { setEmail('admin@aiui.dev'); setPassword('password123') }}
        >
          <span class="font-medium" style={{ color: "var(--ui-text-muted)" }}>Demo — click to fill</span>
          <div class="mt-1 flex flex-col gap-0.5" style={{ color: "var(--ui-text-secondary)", "font-family": "var(--ui-font-mono)" }}>
            <span>admin@aiui.dev</span>
            <span>password123</span>
          </div>
        </div>

        <form onSubmit={submit} class="flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium" style={{ color: "var(--ui-text)" }}>Email</label>
            <input
              type="email"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              placeholder="you@company.com"
              required
              class="px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{
                "background-color": "var(--ui-bg-muted)",
                color: "var(--ui-text)",
                border: "1px solid var(--ui-border)",
              }}
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium" style={{ color: "var(--ui-text)" }}>Password</label>
            <input
              type="password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              placeholder="••••••••"
              required
              class="px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{
                "background-color": "var(--ui-bg-muted)",
                color: "var(--ui-text)",
                border: "1px solid var(--ui-border)",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading()}
            class="mt-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              "background-color": "var(--ui-primary)",
              color: "#0B0F1A",
              "box-shadow": "var(--ui-shadow)",
            }}
          >
            {loading() ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
