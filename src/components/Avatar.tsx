const sizes: Record<string, { wh: string; font: string }> = {
  sm: { wh: '32px', font: '12px' },
  md: { wh: '40px', font: '14px' },
  lg: { wh: '56px', font: '18px' },
}

const palette = [
  'var(--ui-primary)',
  'var(--ui-success)',
  'var(--ui-warning)',
  'var(--ui-info)',
  'var(--ui-error)',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
]

function hashColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return palette[Math.abs(h) % palette.length]
}

export function Avatar(props: { name: string; size?: string }) {
  const s = () => sizes[props.size ?? 'md'] ?? sizes.md
  const initials = () => props.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div
      class="inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0"
      style={{
        "background-color": hashColor(props.name),
        width: s().wh,
        height: s().wh,
        "font-size": s().font,
        "box-shadow": "var(--ui-shadow)",
      }}
    >{initials()}</div>
  )
}
