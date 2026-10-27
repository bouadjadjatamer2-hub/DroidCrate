import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  eyebrow: string
  title: string
  body: string
  children?: ReactNode
}

export function EmptyState({ icon, eyebrow, title, body, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      <p>{body}</p>
      {children ? <div className="empty-state__extra">{children}</div> : null}
    </div>
  )
}
