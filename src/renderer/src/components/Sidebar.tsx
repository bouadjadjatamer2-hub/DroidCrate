import {
  BookOpen,
  GraduationCap,
  History,
  ListChecks,
  Settings,
  ShieldCheck,
  Smartphone,
  Terminal,
  Wrench,
  type LucideIcon
} from 'lucide-react'
import type { SectionId } from '@shared/api'
import { PROJECT_URL } from '@shared/api'
import { useI18n } from '../i18n'

const sections: Array<{ id: SectionId; label: string; icon: LucideIcon }> = [
  { id: 'device', label: 'nav.device', icon: Smartphone },
  { id: 'tools', label: 'nav.tools', icon: Wrench },
  { id: 'adb', label: 'nav.adb', icon: Terminal },
  { id: 'checklists', label: 'nav.checklists', icon: ListChecks },
  { id: 'lessons', label: 'nav.lessons', icon: GraduationCap },
  { id: 'history', label: 'nav.history', icon: History },
  { id: 'settings', label: 'nav.settings', icon: Settings }
]

interface SidebarProps {
  active: SectionId
  version: string
  onSelect: (section: SectionId) => void
}

export function Sidebar({ active, version, onSelect }: SidebarProps) {
  const { t } = useI18n()

  return (
    <aside className="sidebar">
      <div className="sidebar__heading">{t('nav.workspace')}</div>
      <nav className="nav" aria-label={t('nav.workspace')}>
        {sections.map((section) => {
          const Icon = section.icon
          const isActive = active === section.id
          return (
            <button
              key={section.id}
              type="button"
              className={`nav__item${isActive ? ' nav__item--active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelect(section.id)}
            >
              <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
              <span>{t(section.label)}</span>
            </button>
          )
        })}
      </nav>

      <div className="sidebar__spacer" />

      <div className="sidebar__note">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>{t('nav.legal')}</span>
      </div>

      <div className="sidebar__footer">
        <span>{t('footer.version', { version })}</span>
        <span className="dot" aria-hidden="true" />
        <span>{t('footer.license')}</span>
      </div>

      <button
        type="button"
        className="sidebar__docs"
        onClick={() => void window.droidcrate.openExternal(PROJECT_URL)}
      >
        <BookOpen size={15} aria-hidden="true" />
        {t('footer.docs')}
      </button>
    </aside>
  )
}
