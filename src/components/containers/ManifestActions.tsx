import { createSignal, Show, For } from 'solid-js'

export default function ManifestActions(props: {
  containerId: string
  containerStatus: string
  containerSlug?: string
  allReviewed: boolean
  missingSchemas: number
  totalCount: number
}) {
  const [generating, setGenerating] = createSignal(false)
  const [completed, setCompleted] = createSignal(0)
  const [results, setResults] = createSignal<Array<{ name: string; success: boolean; error?: string }>>([])

  const provider = () => {
    const el = document.getElementById('provider-select') as HTMLSelectElement | null
    return el?.value ?? 'ollama'
  }

  const generateSchemas = async () => {
    setGenerating(true)
    setCompleted(0)
    setResults([])

    try {
      const res = await fetch(`/api/v1/containers/${props.containerId}/generate-schemas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider() }),
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        setResults([{ name: 'error', success: false, error: err.error }])
        setGenerating(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7)
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))
            if (eventType === 'progress') {
              setCompleted(data.index)
              setResults(prev => [...prev, { name: data.name, success: data.success, error: data.error }])
            } else if (eventType === 'done') {
              setTimeout(() => window.location.reload(), 1500)
            } else if (eventType === 'error') {
              setResults(prev => [...prev, { name: 'error', success: false, error: data.error }])
              setGenerating(false)
            }
          }
        }
      }
    } catch (e: any) {
      setResults(prev => [...prev, { name: 'error', success: false, error: e.message }])
      setGenerating(false)
    }
  }

  const lockContainer = async () => {
    if (!confirm(`Lock container and deploy all ${props.totalCount} entity types? This cannot be undone.`)) return
    const res = await fetch(`/api/v1/containers/${props.containerId}/lock`, { method: 'POST' })
    if (res.ok) window.location.reload()
    else {
      const err = await res.json()
      alert(err.error)
    }
  }

  const launchApp = async () => {
    const res = await fetch(`/api/v1/containers/${props.containerId}/launch`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      window.location.href = data.appUrl
    } else {
      const err = await res.json()
      alert(err.error)
    }
  }

  return (
    <div>
      <div class="flex items-center gap-2">
        <Show when={props.containerStatus !== 'locked' && props.missingSchemas > 0}>
          <button
            onClick={generateSchemas}
            disabled={generating()}
            class="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40"
            style={{
              "background-color": "rgba(59,143,232,0.12)",
              color: "var(--ui-accent, #3B8FE8)",
              border: "1px solid rgba(59,143,232,0.2)",
            }}
          >
            {generating()
              ? `Generating... ${completed()}/${props.missingSchemas}`
              : `Generate All Schemas (${props.missingSchemas} remaining)`}
          </button>
        </Show>
        <Show when={props.allReviewed && props.containerStatus !== 'locked' && props.containerStatus !== 'launched'}>
          <button
            onClick={lockContainer}
            class="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity"
            style={{
              "background-color": "rgba(34,197,94,0.12)",
              color: "#22C55E",
              border: "1px solid rgba(34,197,94,0.2)",
            }}
          >
            Lock Container
          </button>
        </Show>
        <Show when={props.containerStatus === 'locked'}>
          <button
            onClick={launchApp}
            class="px-5 py-2.5 rounded-lg text-xs font-bold cursor-pointer hover:opacity-90 transition-all"
            style={{
              "background": "linear-gradient(135deg, var(--ui-primary) 0%, var(--ui-primary-hover) 100%)",
              color: "#0B0F1A",
              "box-shadow": "0 2px 12px rgba(212,164,74,0.3)",
            }}
          >
            Launch App
          </button>
        </Show>
        <Show when={props.containerStatus === 'launched'}>
          <a
            href={`/apps/${props.containerSlug}`}
            class="px-5 py-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-2 hover:opacity-90 transition-all"
            style={{
              "background-color": "rgba(212,164,74,0.12)",
              color: "var(--ui-primary)",
              border: "1px solid rgba(212,164,74,0.2)",
            }}
          >
            Open App
          </a>
        </Show>
      </div>

      {/* Live progress feed */}
      <Show when={results().length > 0}>
        <div
          class="mt-3 rounded-lg p-3 text-xs max-h-48 overflow-y-auto"
          style={{
            "background-color": "rgba(240,237,232,0.03)",
            border: "1px solid var(--ui-border)",
          }}
        >
          <For each={results()}>
            {(r) => (
              <div class="flex items-center gap-2 py-0.5">
                <span style={{ color: r.success ? '#22C55E' : 'rgba(239,68,68,0.8)' }}>
                  {r.success ? '✓' : '✗'}
                </span>
                <span style={{ color: 'var(--ui-text)' }}>{r.name}</span>
                <Show when={r.error}>
                  <span style={{ color: 'var(--ui-text-muted)' }}>— {r.error}</span>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
