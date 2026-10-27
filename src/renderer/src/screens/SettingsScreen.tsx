import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CloudDownload,
  Database,
  ExternalLink,
  HardDriveDownload,
  Info,
  Languages,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert
} from 'lucide-react'
import type { AppInfo } from '@shared/api'
import { PROJECT_URL } from '@shared/api'
import { SectionHeader } from '../components/SectionHeader'
import { useContentUpdate } from '../hooks/useContentUpdate'
import { useI18n, type Language } from '../i18n'

interface SettingsScreenProps {
  info: AppInfo | null
}

const languages: Array<{ value: Language; label: string }> = [
  { value: 'en', label: 'settings.english' },
  { value: 'ar', label: 'settings.arabic' }
]

export function SettingsScreen({ info }: SettingsScreenProps) {
  const { t, lang, setLang } = useI18n()
  const content = useContentUpdate()
  const [confirmInstall, setConfirmInstall] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState(false)

  const status = content.status
  const changes = content.result?.changes ?? []
  const visibleChanges = changes.slice(0, 6)
  const hiddenChanges = Math.max(changes.length - visibleChanges.length, 0)
  const busy = content.checking || content.applying || content.restoring
  const errorText = content.error
    ? content.errorCode === 'network'
      ? t('settings.contentOffline')
      : t('settings.contentRejected')
    : null

  return (
    <div className="screen">
      <SectionHeader
        eyebrow={t('settings.eyebrow')}
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
      />

      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="settings-card__heading">
            <Languages size={18} aria-hidden="true" />
            <h2>{t('settings.language')}</h2>
          </div>
          <p>{t('settings.languageHint')}</p>
          <div className="segmented" role="group" aria-label={t('settings.language')}>
            {languages.map((language) => (
              <button
                key={language.value}
                type="button"
                className={`segmented__button${lang === language.value ? ' is-active' : ''}`}
                aria-pressed={lang === language.value}
                onClick={() => setLang(language.value)}
              >
                {t(language.label)}
              </button>
            ))}
          </div>
          <span className="meta-line">{t('settings.languageSaved')}</span>
        </section>

        <section className="panel settings-card">
          <div className="settings-card__heading">
            <Database size={18} aria-hidden="true" />
            <h2>{t('settings.dataTitle')}</h2>
          </div>
          <p>{t('settings.dataBody')}</p>
          <span className="badge">{t('settings.dataBadge')}</span>
        </section>

        <section className="panel settings-card settings-card--wide content-update">
          <div className="settings-card__heading">
            <CloudDownload size={18} aria-hidden="true" />
            <h2>{t('settings.contentTitle')}</h2>
            {status ? (
              <span className="badge badge--quiet settings-card__badge">
                {t(
                  status.source === 'user'
                    ? 'settings.contentInstalled'
                    : 'settings.contentBundled'
                )}
              </span>
            ) : null}
          </div>
          <p>{t('settings.contentBody')}</p>

          <dl className="facts content-update__facts">
            <div>
              <dt>{t('settings.contentVersion')}</dt>
              <dd>{status?.contentVersion ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('settings.contentSource')}</dt>
              <dd>
                {status
                  ? t(
                      status.source === 'user'
                        ? 'settings.contentInstalled'
                        : 'settings.contentBundled'
                    )
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>{t('settings.contentFiles')}</dt>
              <dd>{status?.fileCount ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('settings.contentSourceHint')}</dt>
              <dd className="content-update__source">GitHub</dd>
            </div>
          </dl>

          <p className="content-update__progress-note">{t('settings.contentProgress')}</p>

          {errorText ? (
            <div className="inline-note inline-note--warn" title={content.error ?? undefined}>
              <AlertTriangle size={14} aria-hidden="true" />
              <span>{errorText}</span>
            </div>
          ) : null}

          {content.installedVersion ? (
            <div className="inline-note inline-note--pass">
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>
                {t('settings.contentInstalledNow', { version: content.installedVersion })}
              </span>
            </div>
          ) : null}

          {content.restored ? (
            <div className="inline-note inline-note--pass">
              <CheckCircle2 size={14} aria-hidden="true" />
              <span>{t('settings.contentRestored')}</span>
            </div>
          ) : null}

          {content.result && !content.result.error ? (
            content.result.available ? (
              <div className="content-update__available">
                <div className="content-update__available-head">
                  <strong>
                    {t('settings.contentAvailable', {
                      version: content.result.remoteVersion ?? '—',
                      count: content.result.changes.length
                    })}
                  </strong>
                  <span>
                    {t('settings.contentChanges', { count: content.result.changes.length })}
                  </span>
                </div>
                <ul className="content-update__changes">
                  {visibleChanges.map((change) => (
                    <li key={change.path}>
                      <bdi dir="ltr">{change.path}</bdi>
                      <span className={`content-change content-change--${change.reason}`}>
                        {change.reason}
                      </span>
                    </li>
                  ))}
                  {hiddenChanges > 0 ? (
                    <li className="content-update__more">
                      {t('settings.contentMore', { count: hiddenChanges })}
                    </li>
                  ) : null}
                </ul>
                <div className="content-update__actions">
                  {confirmInstall ? (
                    <>
                      <button
                        type="button"
                        className="button button--primary"
                        disabled={content.applying}
                        onClick={() => {
                          const version = content.result?.remoteVersion
                          if (!version) return
                          void content.apply(version).then((ok) => {
                            if (ok) setConfirmInstall(false)
                          })
                        }}
                      >
                        {content.applying ? (
                          <Loader2 size={14} className="spin" aria-hidden="true" />
                        ) : (
                          <HardDriveDownload size={14} aria-hidden="true" />
                        )}
                        {content.applying
                          ? t('settings.contentApplying')
                          : t('settings.contentConfirm')}
                      </button>
                      <button
                        type="button"
                        className="button button--ghost"
                        disabled={content.applying}
                        onClick={() => setConfirmInstall(false)}
                      >
                        {t('settings.contentCancel')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={() => setConfirmInstall(true)}
                      disabled={busy}
                    >
                      <HardDriveDownload size={14} aria-hidden="true" />
                      {t('settings.contentInstall')}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="inline-note inline-note--pass">
                <CheckCircle2 size={14} aria-hidden="true" />
                <span>{t('settings.contentUpToDate')}</span>
              </div>
            )
          ) : null}

          <div className="content-update__footer">
            <button
              type="button"
              className="button button--ghost button--compact"
              onClick={() => {
                setConfirmInstall(false)
                void content.check()
              }}
              disabled={busy}
            >
              {content.checking ? (
                <Loader2 size={13} className="spin" aria-hidden="true" />
              ) : (
                <RefreshCw size={13} aria-hidden="true" />
              )}
              {content.checking
                ? t('settings.contentChecking')
                : t('settings.contentCheck')}
            </button>

            {status?.source === 'user' ? (
              <div className="content-update__restore">
                {confirmRestore ? (
                  <>
                    <span>{t('settings.contentRestoreHint')}</span>
                    <button
                      type="button"
                      className="button button--danger button--compact"
                      disabled={busy}
                      onClick={() => {
                        void content.restore().then((ok) => {
                          if (ok) setConfirmRestore(false)
                        })
                      }}
                    >
                      {content.restoring ? (
                        <Loader2 size={13} className="spin" aria-hidden="true" />
                      ) : (
                        <RotateCcw size={13} aria-hidden="true" />
                      )}
                      {t('settings.contentRestoreConfirm')}
                    </button>
                    <button
                      type="button"
                      className="button button--ghost button--compact"
                      disabled={busy}
                      onClick={() => setConfirmRestore(false)}
                    >
                      {t('settings.contentCancel')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="button button--ghost button--compact"
                    onClick={() => setConfirmRestore(true)}
                    disabled={busy}
                  >
                    <RotateCcw size={13} aria-hidden="true" />
                    {t('settings.contentRestore')}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel settings-card settings-card--wide">
          <div className="settings-card__heading">
            <ShieldAlert size={18} aria-hidden="true" />
            <h2>{t('settings.safetyTitle')}</h2>
          </div>
          <p>{t('settings.safetyBody')}</p>
        </section>

        <section className="panel settings-card settings-card--wide">
          <div className="settings-card__heading">
            <Info size={18} aria-hidden="true" />
            <h2>{t('settings.aboutTitle')}</h2>
          </div>
          <dl className="facts">
            <div>
              <dt>{t('settings.version')}</dt>
              <dd>{info?.version ?? '0.1.0'}</dd>
            </div>
            <div>
              <dt>{t('settings.license')}</dt>
              <dd>{t('settings.licenseValue')}</dd>
            </div>
            <div>
              <dt>Electron</dt>
              <dd>{info?.electron ?? '—'}</dd>
            </div>
            <div>
              <dt>Node</dt>
              <dd>{info?.node ?? '—'}</dd>
            </div>
          </dl>
          <div className="settings-card__action">
            <div>
              <strong>{t('settings.source')}</strong>
              <span>{t('settings.sourceHint')}</span>
            </div>
            <button
              type="button"
              className="button button--primary"
              onClick={() => void window.droidcrate.openExternal(PROJECT_URL)}
            >
              {t('settings.openSource')}
              <ExternalLink size={15} />
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
