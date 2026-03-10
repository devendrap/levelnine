import { createSignal, Show, For, onMount, createEffect } from 'solid-js'
import DimensionProgress from './DimensionProgress'
import GateDecisionCard from './GateDecisionCard'
import Toast from './Toast'
import type {
  ExplorationRun,
  ExplorationStep,
  DimensionConfig,
  StepName,
  GateDecision,
  ExplorationProgress,
} from '../../lib/containers/types'

interface Props {
  containerId: string
  containerStatus: string
}

export default function ExplorationPanel(props: Props) {
  const [loading, setLoading] = createSignal(true)
  const [running, setRunning] = createSignal(false)
  const [run, setRun] = createSignal<ExplorationRun | null>(null)
  const [dimensions, setDimensions] = createSignal<DimensionConfig[]>([])
  const [steps, setSteps] = createSignal<ExplorationStep[]>([])
  const [completedDimensions, setCompletedDimensions] = createSignal<string[]>([])
  const [currentDimension, setCurrentDimension] = createSignal<DimensionConfig | null>(null)
  const [currentStep, setCurrentStep] = createSignal<StepName | null>(null)
  const [streamOutput, setStreamOutput] = createSignal('')
  const [error, setError] = createSignal<string | null>(null)
  const [gateStep, setGateStep] = createSignal<ExplorationStep | null>(null)

  const isLocked = () => props.containerStatus === 'locked' || props.containerStatus === 'launched'

  const provider = () => {
    const el = document.getElementById('provider-select') as HTMLSelectElement | null
    return el?.value ?? 'ollama'
  }

  const fetchProgress = async () => {
    try {
      const res = await fetch(`/api/v1/containers/${props.containerId}/exploration/progress`)
      if (!res.ok) return
      const data: ExplorationProgress = await res.json()
      setRun(data.run)
      setDimensions(data.dimensions)
      setSteps(data.steps)
      setCompletedDimensions(data.completedDimensions)
      setCurrentDimension(data.currentDimension)
      setCurrentStep(data.currentStep)

      // Check if last step is a completed gate awaiting decision
      if (data.run?.status === 'active' && data.currentStep === 'gate') {
        const gateSteps = data.steps.filter(s => s.step === 'gate' && s.status === 'completed' && !s.gate_decision)
        if (gateSteps.length > 0) {
          setGateStep(gateSteps[gateSteps.length - 1])
        }
      }
    } finally {
      setLoading(false)
    }
  }

  onMount(fetchProgress)

  const startExploration = async () => {
    setError(null)
    try {
      const res = await fetch(`/api/v1/containers/${props.containerId}/exploration/start`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error)
        return
      }
      const newRun = await res.json()
      setRun(newRun)
      await fetchProgress()
      // Auto-run first step
      await runNextStep(newRun.id)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const runNextStep = async (runId?: string) => {
    const id = runId ?? run()?.id
    if (!id) return
    setRunning(true)
    setStreamOutput('')
    setError(null)
    setGateStep(null)

    try {
      const res = await fetch(`/api/v1/containers/${props.containerId}/exploration/next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: id, provider: provider() }),
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        setError(err.error)
        setRunning(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let eventType = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7)
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))
            if (eventType === 'chunk') {
              setStreamOutput(prev => prev + data.text)
            } else if (eventType === 'step') {
              if (data.isGate) {
                setGateStep(data.step)
              }
            } else if (eventType === 'done') {
              await fetchProgress()
            } else if (eventType === 'error') {
              setError(data.error)
            }
          }
        }
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  const onGateDecision = async (decision: GateDecision) => {
    setGateStep(null)
    setStreamOutput('')
    await fetchProgress()

    // Auto-continue if not stopping
    if (decision === 'continue' || decision === 'go_deeper') {
      const currentRun = run()
      if (currentRun?.status === 'active') {
        await runNextStep()
      }
    }
  }

  const stepLabel = (step: StepName) => {
    const labels: Record<StepName, string> = {
      generate: 'Generate',
      self_review: 'Self-Review',
      gaps: 'Gap Analysis',
      gate: 'Gate Decision',
    }
    return labels[step] ?? step
  }

  const stepStatusColor = (status: string) => {
    if (status === 'completed') return '#22C55E'
    if (status === 'running') return 'var(--ui-primary)'
    if (status === 'error') return 'rgba(239,68,68,0.8)'
    return 'var(--ui-text-muted)'
  }

  const phaseLabel = () => {
    const r = run()
    if (!r) return ''
    const labels: Record<string, string> = {
      first_pass: 'First Pass',
      holistic_review: 'Holistic Review',
      explore: 'Deep Exploration',
      locked: 'Locked',
    }
    return labels[r.phase] ?? r.phase
  }

  return (
    <>
    <Toast />
    <div class="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between px-6 py-4 shrink-0" style={{ 'border-bottom': '1px solid var(--ui-border)' }}>
        <div>
          <h2 class="text-base font-semibold" style={{ color: 'var(--ui-text)' }}>Exploration</h2>
          <Show when={run()}>
            <p class="text-xs mt-0.5" style={{ color: 'var(--ui-text-muted)' }}>
              {phaseLabel()} — {run()!.status}
              <Show when={completedDimensions().length > 0}>
                {' '}— {completedDimensions().length}/{dimensions().length} dimensions
              </Show>
            </p>
          </Show>
          <Show when={!run()}>
            <p class="text-xs mt-0.5" style={{ color: 'var(--ui-text-muted)' }}>
              AI-driven multi-dimensional domain exploration
            </p>
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <Show when={!run() && !isLocked()}>
            <button
              onClick={startExploration}
              class="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-90 transition-all"
              style={{
                background: 'linear-gradient(135deg, var(--ui-primary) 0%, var(--ui-primary-hover) 100%)',
                color: '#0B0F1A',
                'box-shadow': '0 2px 12px rgba(212,164,74,0.3)',
              }}
            >
              Start Exploration
            </button>
          </Show>
          <Show when={run()?.status === 'active' && !running() && !gateStep()}>
            <button
              onClick={() => runNextStep()}
              class="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-90 transition-all"
              style={{
                'background-color': 'rgba(212,164,74,0.12)',
                color: 'var(--ui-primary)',
                border: '1px solid rgba(212,164,74,0.25)',
              }}
            >
              Run Next Step
            </button>
          </Show>
          <Show when={running()}>
            <div class="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium" style={{ 'background-color': 'rgba(212,164,74,0.08)', color: 'var(--ui-primary)' }}>
              <div class="w-3 h-3 rounded-full animate-pulse" style={{ 'background-color': 'var(--ui-primary)' }} />
              Running...
            </div>
          </Show>
        </div>
      </div>

      <Show when={loading()}>
        <div class="flex-1 flex items-center justify-center">
          <p class="text-sm" style={{ color: 'var(--ui-text-muted)' }}>Loading...</p>
        </div>
      </Show>

      <Show when={!loading()}>
        <div class="flex-1 overflow-y-auto px-6 py-4">
          {/* Error */}
          <Show when={error()}>
            <div class="rounded-lg p-3 mb-4 text-xs" style={{ 'background-color': 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(239,68,68,0.8)' }}>
              {error()}
            </div>
          </Show>

          {/* Dimension progress pills */}
          <Show when={dimensions().length > 0 && run()}>
            <div class="mb-5">
              <DimensionProgress
                dimensions={dimensions()}
                completedDimensions={completedDimensions()}
                currentDimension={run()?.current_dimension ?? null}
                currentStep={run()?.current_step ?? null}
              />
            </div>
          </Show>

          {/* Current step progress */}
          <Show when={currentDimension() && run()?.status === 'active'}>
            <div class="mb-4">
              <h3 class="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--ui-text-muted)' }}>
                Current: {currentDimension()!.label}
              </h3>
              <p class="text-xs mb-3" style={{ color: 'var(--ui-text-muted)' }}>
                {currentDimension()!.description}
              </p>

              {/* Step indicators */}
              <div class="flex items-center gap-1 mb-4">
                {(['generate', 'self_review', 'gaps', 'gate'] as StepName[]).map(s => {
                  const dimSteps = steps().filter(st => st.dimension === currentDimension()!.dimension && st.step === s)
                  const latest = dimSteps[dimSteps.length - 1]
                  const status = latest?.status ?? (s === currentStep() ? 'next' : 'pending')
                  return (
                    <div class="flex items-center gap-1">
                      <div
                        class="px-2.5 py-1 rounded text-[10px] font-medium"
                        style={{
                          'background-color': status === 'completed' ? 'rgba(34,197,94,0.1)' : status === 'running' ? 'rgba(212,164,74,0.12)' : 'rgba(240,237,232,0.04)',
                          color: status === 'completed' ? '#22C55E' : status === 'running' ? 'var(--ui-primary)' : 'var(--ui-text-muted)',
                        }}
                      >
                        {stepLabel(s)}
                      </div>
                      <Show when={s !== 'gate'}>
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                          <path d="M6 4l4 4-4 4" stroke="var(--ui-text-muted)" stroke-width="1.5" stroke-linecap="round" />
                        </svg>
                      </Show>
                    </div>
                  )
                })}
              </div>
            </div>
          </Show>

          {/* Stream output */}
          <Show when={streamOutput()}>
            <div
              class="rounded-lg p-4 mb-4 text-xs leading-relaxed max-h-80 overflow-y-auto"
              style={{
                'background-color': 'rgba(240,237,232,0.03)',
                border: '1px solid var(--ui-border)',
                color: 'var(--ui-text)',
                'white-space': 'pre-wrap',
                'font-family': "'SF Mono', 'Fira Code', monospace",
                'font-size': '11px',
              }}
            >
              {streamOutput()}
            </div>
          </Show>

          {/* Gate decision card */}
          <Show when={gateStep()}>
            <GateDecisionCard
              stepId={gateStep()!.id}
              containerId={props.containerId}
              dimensionLabel={dimensions().find(d => d.dimension === gateStep()!.dimension)?.label ?? gateStep()!.dimension}
              gateOutput={gateStep()!.llm_output ?? streamOutput()}
              onDecision={onGateDecision}
            />
          </Show>

          {/* Completed steps history */}
          <Show when={steps().length > 0 && !running()}>
            <div class="mt-6">
              <h3 class="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ui-text-muted)' }}>
                History
              </h3>
              <div class="space-y-2">
                <For each={steps().filter(s => s.status === 'completed')}>
                  {(step) => (
                    <details
                      class="rounded-lg overflow-hidden"
                      style={{ border: '1px solid var(--ui-border)', 'background-color': 'rgba(240,237,232,0.02)' }}
                    >
                      <summary class="flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:opacity-80 transition-opacity">
                        <span class="w-2 h-2 rounded-full shrink-0" style={{ 'background-color': stepStatusColor(step.status) }} />
                        <span class="text-xs font-medium" style={{ color: 'var(--ui-text)' }}>
                          {dimensions().find(d => d.dimension === step.dimension)?.label ?? step.dimension}
                        </span>
                        <span class="text-[10px] px-1.5 py-0.5 rounded" style={{ 'background-color': 'rgba(240,237,232,0.06)', color: 'var(--ui-text-muted)' }}>
                          {stepLabel(step.step)}
                        </span>
                        <Show when={step.gate_decision}>
                          <span class="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{
                            'background-color': step.gate_decision === 'continue' ? 'rgba(34,197,94,0.1)' : 'rgba(59,143,232,0.1)',
                            color: step.gate_decision === 'continue' ? '#22C55E' : '#3B8FE8',
                          }}>
                            {step.gate_decision}
                          </span>
                        </Show>
                        <div class="flex-1" />
                        <Show when={step.entity_types_added?.length}>
                          <span class="text-[10px]" style={{ color: 'var(--ui-text-muted)' }}>
                            +{step.entity_types_added.length} types
                          </span>
                        </Show>
                        <Show when={step.relations_added?.length}>
                          <span class="text-[10px]" style={{ color: 'var(--ui-text-muted)' }}>
                            +{step.relations_added.length} rels
                          </span>
                        </Show>
                      </summary>
                      <div
                        class="px-4 py-3 text-xs leading-relaxed border-t"
                        style={{
                          'border-color': 'var(--ui-border)',
                          color: 'var(--ui-text)',
                          'white-space': 'pre-wrap',
                          'max-height': '300px',
                          'overflow-y': 'auto',
                        }}
                      >
                        {step.llm_output ?? '(no output)'}
                      </div>
                    </details>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* Empty state */}
          <Show when={!run() && !loading()}>
            <div class="flex items-center justify-center mt-16">
              <div class="text-center max-w-sm">
                <div
                  class="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
                  style={{ 'background-color': 'rgba(212,164,74,0.08)' }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ui-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <h3 class="text-sm font-semibold mb-1.5" style={{ color: 'var(--ui-text)' }}>
                  Multi-Dimensional Exploration
                </h3>
                <p class="text-xs leading-relaxed" style={{ color: 'var(--ui-text-muted)' }}>
                  AI systematically explores 8 dimensions of your domain: Structure, Roles, Workflows, Compliance, Documents, Integrations, Reporting, and Edge Cases. You gate progress at each step.
                </p>
                <Show when={!isLocked()}>
                  <button
                    onClick={startExploration}
                    class="mt-4 px-5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-90 transition-all"
                    style={{
                      background: 'linear-gradient(135deg, var(--ui-primary) 0%, var(--ui-primary-hover) 100%)',
                      color: '#0B0F1A',
                      'box-shadow': '0 2px 12px rgba(212,164,74,0.3)',
                    }}
                  >
                    Start Exploration
                  </button>
                </Show>
              </div>
            </div>
          </Show>

          {/* Run completed */}
          <Show when={run()?.status === 'completed'}>
            <div
              class="mt-6 rounded-xl p-5 text-center"
              style={{
                'background-color': 'rgba(34,197,94,0.04)',
                border: '1px solid rgba(34,197,94,0.2)',
              }}
            >
              <svg class="mx-auto mb-2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p class="text-sm font-semibold" style={{ color: '#22C55E' }}>Exploration Complete</p>
              <p class="text-xs mt-1" style={{ color: 'var(--ui-text-muted)' }}>
                {completedDimensions().length} dimensions explored. Switch to the Manifest tab to review entity types.
              </p>
            </div>
          </Show>
        </div>
      </Show>
    </div>
    </>
  )
}
