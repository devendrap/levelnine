import { For, Show } from 'solid-js'
import type { DimensionConfig, StepName } from '../../lib/containers/types'

interface Props {
  dimensions: DimensionConfig[]
  completedDimensions: string[]
  currentDimension: string | null
  currentStep: StepName | null
}

export default function DimensionProgress(props: Props) {
  const getStatus = (dim: string) => {
    if (props.completedDimensions.includes(dim)) return 'done'
    if (dim === props.currentDimension) return 'active'
    return 'pending'
  }

  const colors = {
    done: { bg: 'rgba(34,197,94,0.12)', fg: '#22C55E', border: 'rgba(34,197,94,0.25)' },
    active: { bg: 'rgba(212,164,74,0.15)', fg: 'var(--ui-primary)', border: 'rgba(212,164,74,0.35)' },
    pending: { bg: 'rgba(240,237,232,0.04)', fg: 'var(--ui-text-muted)', border: 'var(--ui-border)' },
  }

  const stepLabels: Record<string, string> = {
    generate: 'Generating',
    self_review: 'Reviewing',
    gaps: 'Finding Gaps',
    gate: 'Awaiting Gate',
  }

  return (
    <div class="flex flex-wrap gap-2">
      <For each={props.dimensions}>
        {(dim) => {
          const status = () => getStatus(dim.dimension)
          const c = () => colors[status()]
          return (
            <div
              class="px-3 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all"
              style={{
                'background-color': c().bg,
                color: c().fg,
                border: `1px solid ${c().border}`,
              }}
            >
              <Show when={status() === 'done'}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </Show>
              <Show when={status() === 'active'}>
                <div class="w-2 h-2 rounded-full animate-pulse" style={{ 'background-color': 'var(--ui-primary)' }} />
              </Show>
              {dim.label}
              <Show when={status() === 'active' && props.currentStep}>
                <span class="text-[9px] opacity-70">
                  ({stepLabels[props.currentStep!] ?? props.currentStep})
                </span>
              </Show>
            </div>
          )
        }}
      </For>
    </div>
  )
}
