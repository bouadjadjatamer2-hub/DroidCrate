import { AlertTriangle, CheckCircle2, Download, Loader2, RefreshCw, ShieldCheck, Terminal } from 'lucide-react'
import type { PlatformToolsStatus } from '@shared/platformTools'
import { useI18n } from '../i18n'

interface PlatformToolsCardProps {
  status: PlatformToolsStatus | null
  loading: boolean
  installing: boolean
  onInstall: () => void
  onCancel: () => void
  onRecheck: () => void
}

const stages = ['downloading', 'verifying', 'extracting', 'installing'] as const

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function PlatformToolsCard({
  status,
  loading,
  installing,
  onInstall,
  onCancel,
  onRecheck
}: PlatformToolsCardProps) {
  const { t } = useI18n()
  const stage = status?.stage ?? 'idle'
  const ready = status?.installed === true
  const busy = installing || stages.includes(stage as (typeof stages)[number])
  const progress = status?.progress
  const percent = progress ? Math.min(100, Math.round(progress.percent)) : 0

  return (
    <section className="panel platform-card">
      <div className="platform-card__main">
        <div className="platform-card__head">
          <span className={`platform-card__icon${ready ? ' platform-card__icon--ready' : ''}`}>
            <Terminal size={21} aria-hidden="true" />
          </span>
          <div>
            <div className="eyebrow">{t('adb.platform.eyebrow')}</div>
            <h2>{t('adb.platform.title')}</h2>
          </div>
          <span className={`badge${ready ? '' : ' badge--quiet'}`}>
            {ready ? (
              <CheckCircle2 size={12} aria-hidden="true" />
            ) : (
              <Download size={12} aria-hidden="true" />
            )}
            {ready
              ? t('adb.platform.verified')
              : t(`adb.platform.stage.${stage}`)}
          </span>
        </div>

        <p className="platform-card__copy">
          {ready ? t('adb.platform.installedBody') : t('adb.platform.notInstalledBody')}
        </p>

        {loading ? (
          <div className="platform-card__loading">
            <Loader2 size={15} className="spin" aria-hidden="true" />
            {t('adb.platform.checking')}
          </div>
        ) : null}

        {busy ? (
          <div className="platform-progress">
            <div className="platform-progress__meta">
              <span>{t(`adb.platform.stage.${stage}`)}</span>
              {progress ? (
                <span className="platform-progress__bytes">
                  {t('adb.platform.downloaded', {
                    received: formatBytes(progress.receivedBytes),
                    total: formatBytes(progress.totalBytes)
                  })}
                </span>
              ) : null}
            </div>
            <div
              className={`progress${progress ? '' : ' progress--busy'}`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress ? percent : undefined}
            >
              <span style={progress ? { width: `${percent}%` } : undefined} />
            </div>
          </div>
        ) : null}

        {ready ? (
          <div className="platform-ready">
            <div className="platform-ready__item">
              <span>{t('adb.platform.installedVersion')}</span>
              <strong>{status?.version}</strong>
            </div>
            <div className="platform-ready__item platform-ready__item--wide">
              <span>{t('adb.platform.path')}</span>
              <code title={status?.installPath ?? undefined}>{status?.installPath ?? '—'}</code>
            </div>
          </div>
        ) : null}

        {status?.error ? (
          <div className="inline-note inline-note--warn platform-card__error">
            <AlertTriangle size={15} aria-hidden="true" />
            <div>
              <strong>{t('adb.platform.errorTitle')}</strong>
              <span>{status.error}</span>
            </div>
          </div>
        ) : null}

        <div className="platform-card__actions">
          {busy ? (
            <button type="button" className="button button--ghost" onClick={onCancel}>
              {t('adb.platform.cancel')}
            </button>
          ) : (
            <button
              type="button"
              className="button button--primary"
              onClick={onInstall}
              disabled={loading}
            >
              <Download size={14} aria-hidden="true" />
              {ready ? t('adb.platform.reinstall') : t('adb.platform.install')}
            </button>
          )}
          <button
            type="button"
            className="button button--ghost"
            onClick={onRecheck}
            disabled={busy || loading}
          >
            <RefreshCw size={13} aria-hidden="true" />
            {t('adb.platform.recheck')}
          </button>
        </div>
      </div>

      <aside className="platform-card__facts">
        <dl>
          <div>
            <dt>{t('adb.platform.version')}</dt>
            <dd>{status?.expectedVersion ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('adb.platform.size')}</dt>
            <dd>{formatBytes(status?.sourceSizeBytes ?? 0)}</dd>
          </div>
          <div className="platform-card__hash">
            <dt>{t('adb.platform.hash')}</dt>
            <dd title={status?.expectedSha256}>
              {status?.expectedSha256
                ? `${status.expectedSha256.slice(0, 18)}…${status.expectedSha256.slice(-8)}`
                : '—'}
            </dd>
          </div>
        </dl>

        <div className="platform-card__integrity">
          <ShieldCheck size={15} aria-hidden="true" />
          <div>
            <strong>{t('adb.platform.integrity')}</strong>
            <span>{t('adb.platform.integrityBody')}</span>
          </div>
        </div>

        <button
          type="button"
          className="link-button"
          onClick={() => void window.droidcrate.openExternal(status?.releasePage ?? 'https://developer.android.com/tools/releases/platform-tools')}
        >
          {t('adb.platform.releaseNotes')}
        </button>
      </aside>
    </section>
  )
}
