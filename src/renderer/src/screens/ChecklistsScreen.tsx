import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardList, ShieldCheck } from 'lucide-react'
import type { Checklist } from '@shared/checklists'
import { ChecklistDetail } from '../components/ChecklistDetail'
import { OwnershipGate } from '../components/OwnershipGate'
import { SectionHeader } from '../components/SectionHeader'
import { useChecklistLibrary, useChecklistProgress } from '../hooks/useChecklists'
import { useI18n } from '../i18n'

export function ChecklistsScreen() {
  const { t } = useI18n()
  const { library, loading, error } = useChecklistLibrary()
  const { progress, toggle, complete, reset } = useChecklistProgress()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(false)

  const checklists = useMemo(() => library?.checklists ?? [], [library])
  const selected = checklists.find((checklist) => checklist.id === selectedId) ?? null
  const pending = checklists.find((checklist) => checklist.id === pendingId) ?? null

  function requestChecklist(checklist: Checklist): void {
    if (unlocked) {
      setSelectedId(checklist.id)
      return
    }
    setPendingId(checklist.id)
  }

  function confirmOwnership(): void {
    if (pendingId) setSelectedId(pendingId)
    setUnlocked(true)
    setPendingId(null)
  }

  return (
    <div className="screen">
      <SectionHeader
        eyebrow={t('checklists.eyebrow')}
        title={t('checklists.title')}
        subtitle={t('checklists.subtitle')}
        aside={
          <div className="status-chip">
            <span className="status-chip__dot" aria-hidden="true" />
            <span>{t('checklists.count', { count: checklists.length })}</span>
            <span className="status-chip__sep" aria-hidden="true" />
            <span className="status-chip__muted">{t('checklists.requiredOnly')}</span>
          </div>
        }
      />

      {loading ? (
        <section className="panel empty-state">
          <div className="empty-state__icon">
            <ClipboardList size={26} aria-hidden="true" />
          </div>
          <h2>{t('checklists.loading')}</h2>
        </section>
      ) : null}

      {error ? (
        <section className="panel empty-state">
          <div className="empty-state__icon">
            <AlertTriangle size={26} aria-hidden="true" />
          </div>
          <h2>{t('checklists.errorTitle')}</h2>
          <p>{error}</p>
        </section>
      ) : null}

      {!loading && !error ? (
        <div className="checklist-layout">
          <aside className="checklist-nav-panel">
            <div className="checklist-nav-panel__head">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>{t('checklists.choose')}</span>
            </div>
            <div className="checklist-nav-list">
              {checklists.map((checklist) => {
                const entry = progress[checklist.id]
                const checked = new Set(entry?.checked ?? []).size
                const percent = Math.round((checked / checklist.items.length) * 100)
                const isActive = checklist.id === selectedId
                return (
                  <button
                    key={checklist.id}
                    type="button"
                    className={`checklist-nav${isActive ? ' is-active' : ''}`}
                    onClick={() => requestChecklist(checklist)}
                  >
                    <span className="checklist-nav__head">
                      <span className={`risk-dot risk-dot--${checklist.risk}`} aria-hidden="true" />
                      <strong>{checklist.title}</strong>
                      {entry?.completedAt ? (
                        <CheckCircle2 size={14} aria-hidden="true" className="checklist-nav__done" />
                      ) : null}
                    </span>
                    <span className="checklist-nav__summary">{checklist.summary}</span>
                    <span className="checklist-nav__meta">
                      <span>
                        {checked}/{checklist.items.length}
                      </span>
                      <span className="checklist-nav__bar">
                        <span style={{ width: `${percent}%` }} />
                      </span>
                      <span>{t(`checklists.risk.${checklist.risk}`)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          {selected ? (
            <ChecklistDetail
              key={selected.id}
              checklist={selected}
              entry={progress[selected.id]}
              onToggle={(itemId) => toggle(selected.id, itemId)}
              onComplete={() => complete(selected.id)}
              onReset={() => reset(selected.id)}
            />
          ) : (
            <section className="panel empty-state checklist-intro">
              <div className="empty-state__icon">
                <ClipboardList size={26} aria-hidden="true" />
              </div>
              <h2>{t('checklists.selectTitle')}</h2>
              <p>{t('checklists.selectBody')}</p>
              <div className="checklist-intro__rules">
                <div>
                  <span className="risk-dot risk-dot--high" aria-hidden="true" />
                  <span>{t('checklists.ruleOwnership')}</span>
                </div>
                <div>
                  <span className="risk-dot risk-dot--medium" aria-hidden="true" />
                  <span>{t('checklists.ruleRequired')}</span>
                </div>
                <div>
                  <span className="risk-dot" aria-hidden="true" />
                  <span>{t('checklists.ruleLocal')}</span>
                </div>
              </div>
            </section>
          )}
        </div>
      ) : null}

      {pending ? (
        <OwnershipGate
          checklist={pending}
          onCancel={() => setPendingId(null)}
          onConfirm={confirmOwnership}
        />
      ) : null}
    </div>
  )
}
