import type { ReactNode } from 'react'

interface SectionHeaderProps {
  eyebrow: string
  title: string
  subtitle: string
  aside?: ReactNode
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  aside
}: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {aside ? <div className="section-header__aside">{aside}</div> : null}
    </div>
  )
}
