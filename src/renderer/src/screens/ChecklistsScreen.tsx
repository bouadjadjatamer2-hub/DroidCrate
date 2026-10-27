import { ListChecks } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { SectionHeader } from '../components/SectionHeader'
import { useI18n } from '../i18n'

const operations = ['stock', 'unlock', 'recovery', 'root', 'rom'] as const

export function ChecklistsScreen() {
  const { t } = useI18n()

  return (
    <div className="screen">
      <SectionHeader
        eyebrow={t('checklists.eyebrow')}
        title={t('checklists.title')}
        subtitle={t('checklists.subtitle')}
        aside={<span className="badge">{t('common.stage', { stage: 3 })}</span>}
      />

      <div className="chip-row" aria-hidden="true">
        {operations.map((operation) => (
          <span key={operation} className="chip">
            {t(`checklists.op.${operation}`)}
          </span>
        ))}
      </div>

      <section className="panel">
        <EmptyState
          icon={<ListChecks size={30} strokeWidth={1.5} />}
          eyebrow={t('common.stage', { stage: 3 })}
          title={t('checklists.emptyTitle')}
          body={t('checklists.emptyBody')}
        />
      </section>
    </div>
  )
}
