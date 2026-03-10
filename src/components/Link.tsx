export function Link(props: { label: string; href: string; external?: boolean }) {
  return (
    <a
      href={props.href}
      target={props.external ? '_blank' : undefined}
      rel={props.external ? 'noopener noreferrer' : undefined}
      class="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4 decoration-1 transition-colors duration-100 hover:opacity-70"
      style={{ color: 'var(--ui-primary)' }}
    >
      {props.label}
      {props.external && (
        <svg viewBox="0 0 16 16" fill="none" style={{ width: '12px', height: '12px', "flex-shrink": '0' }}>
          <path d="M6.5 3.5h6m0 0v6m0-6L5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      )}
    </a>
  )
}
