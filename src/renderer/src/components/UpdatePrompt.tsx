import { useEffect, useState } from 'react'
import { ArrowRight, Download, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import { useI18n } from '../i18n'
import { formatBytes, isSnoozed, useAppUpdate } from '../hooks/useAppUpdate'

interface UpdatePromptProps {
  /** The welcome gate must be accepted before the prompt can appear. */
  enabled: boolean
}

/**
 * Asks before anything is downloaded, shows progress while the installer is
 * fetched, and asks again before restarting. "Stay on this version" is
 * remembered by the main process until a newer release exists.
 */
export function UpdatePrompt({ enabled }: UpdatePromptProps) {
  const { t } = useI18n()
  const { state, download, install, later, skip } = useAppUpdate()
  const [hidden, setHidden] = useState<{ version: string; phase: string } | null>(null)
  const [installing, setInstalling] = useState(false)

  // A new check means the owner asked again: forget that this prompt was
  // dismissed earlier. `checkedAt` changes at the start of every check, which
  // also covers a check that completes too fast to render "checking".
  useEffect(() => {
    setHidden(null)
  }, [state?.checkedAt])

  if (!enabled || !state?.supported) return null

  const version = state.availableVersion
  if (!version) return null

  const snoozed = isSnoozed(state)
  const skipped = state.skippedVersion === version
  const hiddenHere =
    hidden !== null && hidden.version === version && hidden.phase === state.phase

  if (hiddenHere) return null
  if (snoozed || skipped) return null
  if (!['available', 'downloading', 'ready', 'error'].includes(state.phase)) return null

  function close(): void {
    setHidden({ version: version as string, phase: state?.phase ?? 'available' })
  }

  const isDownloading = state.phase === 'downloading'
  const isReady = state.phase === 'ready'
  const hasError = state.phase === 'error'
  const percent = state.progress ?? 0

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal update-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-title"
        aria-describedby="update-body"
      >
        <div className="modal__icon">
          {hasError ? <RotateCcw size={24} aria-hidden="true" /> : <Sparkles size={24} aria-hidden="true" />}
        </div>
        <div className="eyebrow">{t('updates.eyebrow')}</div>

        <h2 id="update-title">
          {hasError
            ? t('updates.errorTitle')
            : isReady
              ? t('updates.readyTitle')
              : isDownloading
                ? t('updates.downloading')
                : t('updates.title')}
        </h2>

        <p className="modal__body" id="update-body">
          {hasError
            ? (state.error ?? t('updates.error'))
            : isReady
              ? t('updates.readyBody', { version })
              : isDownloading
                ? t('updates.downloadingBody')
                : t('updates.body', { current: state.currentVersion, version })}
        </p>

        {!isDownloading ? (
          <div className="update-versions">
            <div>
              <span>{t('updates.current')}</span>
              <strong>{state.currentVersion}</strong>
            </div>
            <ArrowRight size={14} className="update-versions__arrow" aria-hidden="true" />
            <div>
              <span>{t('updates.new')}</span>
              <strong>{version}</strong>
            </div>
          </div>
        ) : null}

        {!isDownloading && !isReady && !hasError && state.releaseNotes ? (
          <div className="update-notes">
            <span className="update-notes__label">{t('updates.notes')}</span>
            <p>{state.releaseNotes}</p>
          </div>
        ) : null}

        {isDownloading ? (
          <div className="update-progress" aria-live="polite">
            <div className="update-progress__head">
              <span>{t('updates.percent', { value: percent })}</span>
              <span>{t('updates.downloaded', {
                done: formatBytes(state.transferred),
                total: formatBytes(state.total)
              })}</span>
            </div>
            <div
              className="progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <span style={{ width: `${percent}%` }} />
            </div>
          </div>
        ) : null}

        {hasError ? (
          <div className="inline-note inline-note--warn">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>{t('updates.error')}</span>
          </div>
        ) : null}

        <div className="modal__actions update-actions">
          {hasError ? (
            <>
              <button
                type="button"
                className="button button--primary"
                onClick={() => void download()}
              >
                <Download size={14} aria-hidden="true" />
                {t('updates.retry')}
              </button>
              <button type="button" className="button button--ghost" onClick={close}>
                {t('updates.close')}
              </button>
            </>
          ) : isReady ? (
            <>
              <button
                type="button"
                className="button button--primary"
                disabled={installing}
                onClick={() => {
                  setInstalling(true)
                  void install()
                }}
              >
                <RotateCcw size={14} aria-hidden="true" />
                {t('updates.restart')}
              </button>
              <button type="button" className="button button--ghost" onClick={close}>
                {t('updates.close')}
              </button>
            </>
          ) : isDownloading ? (
            <button type="button" className="button button--ghost" onClick={close}>
              {t('updates.hide')}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="button button--primary"
                onClick={() => void download()}
              >
                <Download size={14} aria-hidden="true" />
                {t('updates.download')}
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  close()
                  void later()
                }}
              >
                {t('updates.later')}
              </button>
              <button
                type="button"
                className="button button--ghost button--compact update-skip"
                onClick={() => {
                  close()
                  void skip()
                }}
              >
                {t('updates.skip')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
