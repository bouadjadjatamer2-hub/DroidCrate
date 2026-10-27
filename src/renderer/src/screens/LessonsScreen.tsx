import { GraduationCap } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { SectionHeader } from '../components/SectionHeader'
import { useI18n } from '../i18n'

const levels = ['basic', 'intermediate', 'advanced'] as const

export function LessonsScreen() {
  const { t } = useI18n()

  return (
    <div className="screen">
      <SectionHeader
        eyebrow={t('lessons.eyebrow')}
        title={t('lessons.title')}
        subtitle={t('lessons.subtitle')}
        aside={<span className="badge">{t('common.stage', { stage: 5 })}</span>}
      />

      <div className="level-grid" aria-hidden="true">
        {levels.map((level) => (
          <div key={level} className="panel level-card">
            <span className="level-card__label">{t(`lessons.level.${level}`)}</span>
            <span className="level-card__value">0%</span>
            <div className="progress">
              <span style={{ width: '0%' }} />
            </div>
          </div>
        ))}
      </div>

      <section className="panel">
        <EmptyState
          icon={<GraduationCap size={30} strokeWidth={1.5} />}
          eyebrow={t('common.stage', { stage: 5 })}
          title={t('lessons.emptyTitle')}
          body={t('lessons.emptyBody')}
        />
      </section>
    </div>
  )
}
