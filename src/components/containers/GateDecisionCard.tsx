import { createSignal, Show } from 'solid-js'
import type { GateDecision } from '../../lib/containers/types'
import { showToast } from './Toast'
import { clean } from '../../lib/sanitize'

interface Props {
  stepId: string
  containerId: string
  dimensionLabel: string
  gateOutput: string
  onDecision: (decision: GateDecision) => void
}

export default function GateDecisionCard(props: Props) {
  const [submitting, setSubmitting] = createSignal(false)
  const [notes, setNotes] = createSignal('')

  const submit = async (decision: GateDecision) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/containers/${props.containerId}/exploration/gate/${props.stepId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes: notes() || undefined }),
      })
      if (!res.ok) {
        const err = await res.json()
        showToast(err.error)
        return
      }
      props.onDecision(decision)
    } finally {
      setSubmitting(false)
    }
  }

  const buttons: Array<{ decision: GateDecision; label: string; desc: string; color: string; bg: string }> = [
    { decision: 'continue', label: 'Continue', desc: 'Move to next dimension', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
    { decision: 'go_deeper', label: 'Go Deeper', desc: 'Re-explore this dimension', color: '#3B8FE8', bg: 'rgba(59,143,232,0.1)' },
    { decision: 'skip', label: 'Skip', desc: 'Skip to next dimension', color: 'var(--ui-text-muted)', bg: 'rgba(240,237,232,0.06)' },
    { decision: 'stop', label: 'Stop', desc: 'Pause exploration', color: 'rgba(239,68,68,0.8)', bg: 'rgba(239,68,68,0.08)' },
  ]

  return (
    <div
      class="rounded-xl p-5 mt-4"
      style={{
        border: '1.5px solid rgba(212,164,74,0.3)',
        'background-color': 'rgba(212,164,74,0.04)',
        'box-shadow': '0 4px 16px rgba(212,164,74,0.08)',
      }}
    >
      <div class="flex items-center gap-2 mb-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ui-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <h3 class="text-sm font-semibold" style={{ color: 'var(--ui-text)' }}>
          Gate: {props.dimensionLabel}
        </h3>
      </div>

      <Show when={props.gateOutput}>
        <div
          class="text-xs leading-relaxed mb-4 p-3 rounded-lg max-h-48 overflow-y-auto"
          style={{
            color: 'var(--ui-text)',
            'background-color': 'rgba(240,237,232,0.03)',
            border: '1px solid var(--ui-border)',
            'white-space': 'pre-wrap',
          }}
          innerHTML={clean(props.gateOutput)}
        />
      </Show>

      <textarea
        value={notes()}
        onInput={(e) => setNotes(e.currentTarget.value)}
        placeholder="Optional notes for this decision..."
        class="w-full text-xs p-2.5 rounded-lg mb-4 resize-none outline-none"
        style={{
          'background-color': 'rgba(240,237,232,0.04)',
          border: '1px solid var(--ui-border)',
          color: 'var(--ui-text)',
          height: '60px',
        }}
      />

      <div class="grid grid-cols-2 gap-2">
        {buttons.map(btn => (
          <button
            onClick={() => submit(btn.decision)}
            disabled={submitting()}
            class="px-4 py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-90 transition-all disabled:opacity-40 flex flex-col items-center gap-0.5"
            style={{
              'background-color': btn.bg,
              color: btn.color,
              border: `1px solid ${btn.color}22`,
            }}
          >
            <span>{btn.label}</span>
            <span class="text-[9px] opacity-60 font-normal">{btn.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
