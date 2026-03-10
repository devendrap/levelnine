import { createEffect, onCleanup } from 'solid-js'

type ChartType = 'bar' | 'line' | 'doughnut' | 'pie'

export function Chart(props: { type?: string; labels: string[]; datasets: { label: string; data: number[]; color?: string }[]; height?: string }) {
  let canvasRef!: HTMLCanvasElement
  let chartInstance: any = null

  const defaultColors = [
    'var(--ui-primary)', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
  ]

  createEffect(async () => {
    const { Chart: ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, BarController, LineController, DoughnutController, PieController } = await import('chart.js')
    ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, BarController, LineController, DoughnutController, PieController)

    if (chartInstance) chartInstance.destroy()

    const type = (props.type ?? 'bar') as ChartType
    const isArc = type === 'doughnut' || type === 'pie'

    const resolvedColor = (cssVar: string) => {
      if (!cssVar.startsWith('var(')) return cssVar
      const name = cssVar.replace('var(', '').replace(')', '')
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || cssVar
    }

    chartInstance = new ChartJS(canvasRef, {
      type,
      data: {
        labels: props.labels,
        datasets: props.datasets.map((ds, i) => {
          const color = resolvedColor(ds.color ?? defaultColors[i % defaultColors.length])
          return {
            label: ds.label,
            data: ds.data,
            backgroundColor: isArc
              ? props.labels.map((_, j) => resolvedColor(defaultColors[j % defaultColors.length]) + 'cc')
              : color + '33',
            borderColor: isArc
              ? props.labels.map((_, j) => resolvedColor(defaultColors[j % defaultColors.length]))
              : color,
            borderWidth: isArc ? 2 : 2,
            borderRadius: type === 'bar' ? 4 : undefined,
            pointRadius: type === 'line' ? 4 : undefined,
            pointBackgroundColor: type === 'line' ? color : undefined,
            tension: type === 'line' ? 0.3 : undefined,
            fill: type === 'line',
          }
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: isArc ? 'bottom' : 'top',
            labels: {
              color: resolvedColor('var(--ui-text-secondary)'),
              padding: 16,
              usePointStyle: true,
              pointStyle: 'circle',
              font: { size: 12, family: 'Inter, system-ui, sans-serif' },
            },
          },
          tooltip: {
            backgroundColor: resolvedColor('var(--ui-text)'),
            titleColor: resolvedColor('var(--ui-bg)'),
            bodyColor: resolvedColor('var(--ui-bg)'),
            cornerRadius: 8,
            padding: 10,
            titleFont: { size: 12, weight: 'bold' as const },
            bodyFont: { size: 12 },
          },
        },
        scales: isArc ? {} : {
          x: {
            grid: { color: resolvedColor('var(--ui-border)') + '40' },
            ticks: { color: resolvedColor('var(--ui-text-muted)'), font: { size: 11 } },
          },
          y: {
            grid: { color: resolvedColor('var(--ui-border)') + '40' },
            ticks: { color: resolvedColor('var(--ui-text-muted)'), font: { size: 11 } },
          },
        },
      },
    })
  })

  onCleanup(() => { if (chartInstance) chartInstance.destroy() })

  return (
    <div
      class="rounded-lg border p-4"
      style={{
        "background-color": 'var(--ui-bg)',
        "border-color": 'var(--ui-border)',
        height: props.height ?? '300px',
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  )
}
