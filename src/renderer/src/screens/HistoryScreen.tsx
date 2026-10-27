import { Download, FileText, History, Search } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { SectionHeader } from '../components/SectionHeader'
import { useI18n } from '../i18n'

export function HistoryScreen() {
  const { t } = useI18n()

  return (
    <div className="screen">
      <SectionHeader
        eyebrow={t('history.eyebrow')}
        title={t('history.title')}
        subtitle={t('history.subtitle')}
        aside={<span className="badge">{t('common.stage', { stage: 6 })}</span>}
      />

      <div className="toolbar toolbar--disabled" aria-hidden="true">
        <div className="field">
          <Search size={16} />
          <span>Search by device or operation…</span>
        </div>
        <button type="button" className="button button--ghost" disabled>
          <FileText size={16} />
          {t('history.exportTxt')}
        </button>
        <button type="button" className="button button--ghost" disabled>
          <Download size={16} />
          {t('history.exportCsv')}
        </button>
      </div>

      <section className="panel">
        <EmptyState
          icon={<History size={30} strokeWidth={1.5} />}
          eyebrow={t('common.stage', { stage: 6 })}
          title={t('history.emptyTitle')}
          body={t('history.emptyBody')}
        />
      </section>
    </div>
  )
}
