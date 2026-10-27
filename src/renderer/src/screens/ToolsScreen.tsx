import { Search, ShieldCheck, SlidersHorizontal, Wrench } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { SectionHeader } from '../components/SectionHeader'
import { useI18n } from '../i18n'

export function ToolsScreen() {
  const { t } = useI18n()

  return (
    <div className="screen">
      <SectionHeader
        eyebrow={t('tools.eyebrow')}
        title={t('tools.title')}
        subtitle={t('tools.subtitle')}
        aside={<span className="badge">{t('common.stage', { stage: 2 })}</span>}
      />

      <div className="toolbar toolbar--disabled" aria-hidden="true">
        <div className="field">
          <Search size={16} />
          <span>Search tools, brands, chipsets…</span>
        </div>
        <button type="button" className="button button--ghost" disabled>
          <SlidersHorizontal size={16} />
          Filters
        </button>
      </div>

      <section className="panel">
        <EmptyState
          icon={<Wrench size={30} strokeWidth={1.5} />}
          eyebrow={t('common.stage', { stage: 2 })}
          title={t('tools.emptyTitle')}
          body={t('tools.emptyBody')}
        >
          <div className="inline-note">
            <ShieldCheck size={16} aria-hidden="true" />
            <div>
              <strong>{t('tools.officialOnly')}</strong>
              <span>{t('tools.officialOnlyBody')}</span>
            </div>
          </div>
        </EmptyState>
      </section>
    </div>
  )
}
