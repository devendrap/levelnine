import { createSignal, Show, ErrorBoundary } from 'solid-js'
import { Renderer } from '../renderer/Renderer'

/**
 * Reusable schema preview/code panel with toggle buttons.
 * Used in both chat messages and the manifest tab.
 */
export function SchemaPreviewPanel(props: {
  name: string
  schema: Record<string, any>
  /** Show the name header bar (default true) */
  showHeader?: boolean
  /** Initial mode — null (collapsed), 'preview', or 'code' */
  defaultMode?: 'preview' | 'code' | null
}) {
  const [mode, setMode] = createSignal<'preview' | 'code' | null>(props.defaultMode ?? null)

  const toggleMode = (m: 'preview' | 'code') => {
    setMode(mode() === m ? null : m)
  }

  return (
    <div
      class="rounded-lg overflow-hidden"
      style={{
        border: "1px solid rgba(212,164,74,0.15)",
        "background-color": "rgba(212,164,74,0.03)",
      }}
    >
      {/* Header with name + toggle icons */}
      <div
        class="flex items-center justify-between px-4 py-2.5"
        style={{ "border-bottom": mode() ? "1px solid rgba(212,164,74,0.1)" : "none" }}
      >
        <Show when={props.showHeader !== false}>
          <div class="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ui-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
            </svg>
            <span class="text-xs font-semibold" style={{ color: "var(--ui-text)" }}>
              {props.name}
            </span>
          </div>
        </Show>
        <div class="flex items-center gap-1">
          {/* Eye icon — preview */}
          <button
            onClick={() => toggleMode('preview')}
            class="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer hover:opacity-80 transition-all"
            style={{
              "background-color": mode() === 'preview'
                ? "rgba(212,164,74,0.18)"
                : "rgba(212,164,74,0.06)",
              color: "var(--ui-primary)",
            }}
            title="Preview rendered form"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          {/* Code icon — JSON */}
          <button
            onClick={() => toggleMode('code')}
            class="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer hover:opacity-80 transition-all"
            style={{
              "background-color": mode() === 'code'
                ? "rgba(59,143,232,0.18)"
                : "rgba(59,143,232,0.06)",
              color: "var(--ui-accent, #3B8FE8)",
            }}
            title="View raw JSON schema"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      <Show when={mode()}>
        <div class="px-4 py-3">
          <Show when={mode() === 'preview'}>
            <div class="flex items-center justify-between mb-2">
              <span class="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ui-text-muted)" }}>
                Form Preview
              </span>
            </div>
            <div
              class="rounded-lg"
              style={{
                border: "1.5px solid rgba(212,164,74,0.35)",
                "box-shadow": "0 0 12px rgba(212,164,74,0.08), inset 0 0 0 1px rgba(212,164,74,0.05)",
                "background-color": "rgba(240,237,232,0.02)",
                "pointer-events": "none",
                opacity: "0.85",
                padding: "16px",
              }}
            >
              <ErrorBoundary fallback={(err: Error) => (
                <div class="text-xs p-3" style={{ color: "rgba(239,68,68,0.8)" }}>
                  Render error: {err.message}
                </div>
              )}>
                <Renderer node={props.schema as any} />
              </ErrorBoundary>
            </div>
          </Show>
          <Show when={mode() === 'code'}>
            <div class="flex items-center justify-between mb-2">
              <span class="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ui-text-muted)" }}>
                JSON Schema
              </span>
            </div>
            <pre
              class="rounded-lg border overflow-y-auto text-xs leading-relaxed"
              style={{
                "border-color": "rgba(59,143,232,0.15)",
                "background-color": "rgba(59,143,232,0.03)",
                "max-height": "500px",
                padding: "16px",
                color: "var(--ui-text)",
                "white-space": "pre-wrap",
                "word-break": "break-word",
                "font-family": "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
                "font-size": "11px",
              }}
            >
              {JSON.stringify(props.schema, null, 2)}
            </pre>
          </Show>
        </div>
      </Show>
    </div>
  )
}
