const sizes: Record<string, string> = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' }
const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']

function hashColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return colors[Math.abs(h) % colors.length]
}

export function Avatar(props: { name: string; size?: string }) {
  const initials = () => props.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div
      class={`inline-flex items-center justify-center rounded-full font-medium text-white ${sizes[props.size ?? 'md']}`}
      style={{ "background-color": hashColor(props.name) }}
    >{initials()}</div>
  )
}
