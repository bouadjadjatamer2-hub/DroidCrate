import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  History,
  Loader2,
  Search,
  Trash2,
  XCircle
} from 'lucide-react'
import type { HistoryCategory, HistoryEntry, HistoryResult } from '@shared/history'
import { EmptyState } from '../components/EmptyState'
import { SectionHeader } from '../components/SectionHeader'
import { useHistory } from '../hooks/useHistory'
import { useI18n } from '../i18n'

type CategoryFilter = HistoryCategory | 'all'
type ResultFilter = HistoryResult | 'all'

const CATEGORY_LABEL_KEYS: Record<HistoryCategory, string> = {
  adb: 'history.adb',
  fastboot: 'history.fastboot',
  'platform-tools': 'history.platformTools',
  checklist: 'history.checklist'
}

const CATEGORY_OPTIONS: CategoryFilter[] = ['all', 'adb', 'fastboot', 'platform-tools', 'checklist']
const RESULT_OPTIONS: ResultFilter[] = ['all', 'success', 'failure']

function formatTime(value: string, lang: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    // Latin digits keep timestamps readable inside the RTL interface.
    numberingSystem: 'latn'
  })
    .format(date)
    .replace(/[\u200e\u200f]/g, '')
}

function matches(entry: HistoryEntry, search: string): boolean {
  if (!search) return true
  return [entry.command, entry.action, entry.serial, entry.detail]
    .filter(Boolean)
    .some((value) => value?.toLowerCase().includes(search))
}

export function HistoryScreen() {
  const { t, lang } = useI18n()
  const { entries, loading, error, exporting, clear, exportAs } = useHistory()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [result, setResult] = useState<ResultFilter>('all')
  const [confirmClear, setConfirmClear] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return entries.filter(
      (entry) =>
        (category === 'all' || entry.category === category) &&
        (result === 'all' || entry.result === result) &&
        matches(entry, needle)
    )
  }, [category, entries, result, search])

  async function exportHistory(format: 'txt' | 'csv'): Promise<void> {
    setExportError(null)
    setNotice(null)
    const outcome = await exportAs(format)
    if (!outcome) {
      setExportError(t('history.exportFailed'))
      return
    }
    if (outcome.saved) {
      setNotice(t('history.exported', { count: outcome.count }))
    }
  }

  async function clearHistory(): Promise<void> {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    await clear()
    setConfirmClear(false)
    setNotice(null)
  }

  return (
    <div className="screen">
      <SectionHeader
        eyebrow={t('history.eyebrow')}
        title={t('history.title')}
        subtitle={t('history.subtitle')}
        aside={
          <div className="status-chip">
            <span
              className={`status-chip__dot${entries.length > 0 ? ' status-chip__dot--live' : ''}`}
              aria-hidden="true"
            />
            <span>{t('history.count', { count: entries.length })}</span>
            <span className="status-chip__sep" aria-hidden="true" />
            <span className="status-chip__muted">{t('history.local')}</span>
          </div>
        }
      />

      <section className="panel history-toolbar">
        <div className="history-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('history.search')}
            aria-label={t('history.search')}
          />
        </div>

        <div className="history-filters">
          <label>
            <span>{t('history.category')}</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as CategoryFilter)}
            >
              {CATEGORY_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === 'all' ? t('history.all') : t(CATEGORY_LABEL_KEYS[value])}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('history.result')}</span>
            <select
              value={result}
              onChange={(event) => setResult(event.target.value as ResultFilter)}
            >
              {RESULT_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === 'all'
                    ? t('history.all')
                    : value === 'success'
                      ? t('history.success')
                      : t('history.failure')}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="history-actions">
          <button
            type="button"
            className="button button--ghost button--compact"
            onClick={() => void exportHistory('txt')}
            disabled={entries.length === 0 || exporting !== null}
          >
            {exporting === 'txt' ? (
              <Loader2 size={13} className="spin" aria-hidden="true" />
            ) : (
              <FileText size={13} aria-hidden="true" />
            )}
            {t('history.exportTxt')}
          </button>
          <button
            type="button"
            className="button button--ghost button--compact"
            onClick={() => void exportHistory('csv')}
            disabled={entries.length === 0 || exporting !== null}
          >
            {exporting === 'csv' ? (
              <Loader2 size={13} className="spin" aria-hidden="true" />
            ) : (
              <Download size={13} aria-hidden="true" />
            )}
            {t('history.exportCsv')}
          </button>
          {confirmClear ? (
            <>
              <button
                type="button"
                className="button button--danger button--compact"
                onClick={() => void clearHistory()}
              >
                <Trash2 size={13} aria-hidden="true" />
                {t('history.clearConfirm')}
              </button>
              <button
                type="button"
                className="button button--ghost button--compact"
                onClick={() => setConfirmClear(false)}
              >
                {t('history.cancel')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="button button--ghost button--compact"
              onClick={() => void clearHistory()}
              disabled={entries.length === 0}
            >
              <Trash2 size={13} aria-hidden="true" />
              {t('history.clear')}
            </button>
          )}
        </div>
      </section>

      <p className="history-note">{t('history.clearNote')}</p>

      {notice ? <div className="inline-note inline-note--pass">{notice}</div> : null}
      {exportError ? (
        <div className="inline-note inline-note--warn">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{exportError}</span>
        </div>
      ) : null}
      {error ? (
        <div className="inline-note inline-note--warn">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <section className="panel empty-state">
          <div className="empty-state__icon">
            <Loader2 size={26} className="spin" aria-hidden="true" />
          </div>
          <h2>{t('history.loading')}</h2>
        </section>
      ) : entries.length === 0 ? (
        <section className="panel">
          <EmptyState
            icon={<History size={30} strokeWidth={1.5} />}
            eyebrow={t('common.stage', { stage: 6 })}
            title={t('history.emptyTitle')}
            body={t('history.emptyBody')}
          />
        </section>
      ) : filtered.length === 0 ? (
        <section className="panel empty-state">
          <div className="empty-state__icon">
            <Search size={26} aria-hidden="true" />
          </div>
          <h2>{t('history.noMatches')}</h2>
        </section>
      ) : (
        <div className="history-list">
          {filtered.map((entry) => (
            <details key={entry.id} className="history-entry">
              <summary>
                <span
                  className={`history-state history-state--${entry.result}`}
                  aria-hidden="true"
                >
                  {entry.result === 'success' ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <XCircle size={15} />
                  )}
                </span>
                <span className="history-entry__copy">
                  <strong>{entry.command}</strong>
                  <span>
                    {t(CATEGORY_LABEL_KEYS[entry.category])}
                    {entry.serial ? ` · ${entry.serial}` : ''} ·{' '}
                    <bdi dir="ltr">{formatTime(entry.startedAt, lang)}</bdi>
                  </span>
                </span>
                <span className={`badge${entry.result === 'success' ? '' : ' badge--quiet'}`}>
                  {t(entry.result === 'success' ? 'history.success' : 'history.failure')}
                </span>
                <span className="history-entry__chevron">
                  <ChevronDown size={14} aria-hidden="true" />
                </span>
              </summary>
              <div className="history-entry__body">
                <dl className="facts">
                  <div>
                    <dt>{t('history.action')}</dt>
                    <dd>{entry.action}</dd>
                  </div>
                  <div>
                    <dt>{t('history.device')}</dt>
                    <dd>{entry.serial ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>{t('history.time')}</dt>
                    <dd>
                      <bdi dir="ltr">{formatTime(entry.startedAt, lang)}</bdi>
                    </dd>
                  </div>
                </dl>
                {entry.detail ? (
                  <div className="history-entry__detail">
                    <strong>{t('history.detail')}</strong>
                    <p>{entry.detail}</p>
                  </div>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
