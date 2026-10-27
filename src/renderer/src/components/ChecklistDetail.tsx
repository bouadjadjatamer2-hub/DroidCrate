import { CheckCircle2, ClipboardList, RotateCcw } from 'lucide-react'
import type { Checklist } from '@shared/checklists'
import type { ChecklistProgress } from '../hooks/useChecklists'
import { useI18n } from '../i18n'

interface ChecklistDetailProps {
  checklist: Checklist
  entry: ChecklistProgress | undefined
  onToggle: (itemId: string) => void
  onComplete: () => void
  onReset: () => void
}

function formatCompletedAt(value: string, lang: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

export function ChecklistDetail({
  checklist,
  entry,
  onToggle,
  onComplete,
  onReset
}: ChecklistDetailProps) {
  const { t, lang } = useI18n()
  const checked = new Set(entry?.checked ?? [])
  const required = checklist.items.filter((item) => item.required)
  const requiredLeft = required.filter((item) => !checked.has(item.id)).length
  const checkedCount = checklist.items.filter((item) => checked.has(item.id)).length
  const percent = Math.round((checkedCount / checklist.items.length) * 100)
  const completedAt = entry?.completedAt ?? null

  return (
    <section className="panel checklist-detail">
      <div className="checklist-detail__head">
        <div>
          <div className="eyebrow">{t('checklists.checklist')}</div>
          <h2>{checklist.title}</h2>
          <p>{checklist.summary}</p>
        </div>
        <span className={`risk risk--${checklist.risk}`}>
          {t(`checklists.risk.${checklist.risk}`)}
        </span>
      </div>

      <div className="checklist-progress">
        <div className="progress">
          <span style={{ width: `${percent}%` }} />
        </div>
        <span className="checklist-progress__label">
          {t('checklists.progress', { checked: checkedCount, total: checklist.items.length })}
        </span>
      </div>

      <div className="inline-note inline-note--warn checklist-warning">
        <ClipboardList size={15} aria-hidden="true" />
        <div>
          <strong>{t('checklists.warning')}</strong>
          <span>{checklist.warning}</span>
        </div>
      </div>

      {completedAt ? (
        <div className="completion">
          <CheckCircle2 size={18} aria-hidden="true" />
          <div>
            <strong>{t('checklists.completed')}</strong>
            <span>{t('checklists.completedAt', { date: formatCompletedAt(completedAt, lang) })}</span>
          </div>
        </div>
      ) : null}

      <ol className="check-items">
        {checklist.items.map((item) => {
          const isChecked = checked.has(item.id)
          return (
            <li key={item.id}>
              <label className={`check-item${isChecked ? ' is-checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggle(item.id)}
                />
                <span className="check-item__copy">
                  <span className="check-item__title">
                    <strong>{item.title}</strong>
                    <span className={`requirement${item.required ? ' requirement--required' : ''}`}>
                      {item.required
                        ? t('checklists.required')
                        : t('checklists.optional')}
                    </span>
                  </span>
                  <span className="check-item__detail">{item.detail}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ol>

      <div className="checklist-detail__footer">
        <div className="checklist-detail__hint">
          {completedAt ? (
            <span>{t('checklists.completedHint')}</span>
          ) : requiredLeft > 0 ? (
            <span>{t('checklists.requiredLeft', { count: requiredLeft })}</span>
          ) : (
            <span>{t('checklists.ready')}</span>
          )}
        </div>
        <div className="checklist-detail__actions">
          {checkedCount > 0 ? (
            <button type="button" className="button button--ghost" onClick={onReset}>
              <RotateCcw size={13} aria-hidden="true" />
              {t('checklists.reset')}
            </button>
          ) : null}
          {!completedAt ? (
            <button
              type="button"
              className="button button--primary"
              onClick={onComplete}
              disabled={requiredLeft > 0}
            >
              <CheckCircle2 size={14} aria-hidden="true" />
              {t('checklists.complete')}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
