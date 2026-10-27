import {
  AlertTriangle,
  Cable,
  CircleDot,
  LockOpen,
  RefreshCw,
  Smartphone,
  Usb
} from 'lucide-react'
import { SectionHeader } from '../components/SectionHeader'
import { DeviceCard } from '../components/DeviceCard'
import { useDeviceState } from '../hooks/useDeviceState'
import { useI18n } from '../i18n'

const modes = ['adb', 'fastboot', 'download', 'edl', 'brom'] as const

function formatTime(value: string, lang: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date)
}

export function DeviceScreen() {
  const { t, lang } = useI18n()
  const { state, loading, scanning, rescan } = useDeviceState()
  const detected = state.devices.length
  const activeModes = new Set(state.devices.map((device) => device.mode))

  return (
    <div className="screen">
      <SectionHeader
        eyebrow={t('device.eyebrow')}
        title={t('device.title')}
        subtitle={t('device.subtitle')}
        aside={
          <div className="status-chip">
            <span
              className={`status-chip__dot${detected > 0 ? ' status-chip__dot--live' : ''}`}
              aria-hidden="true"
            />
            <span>
              {loading
                ? t('device.liveScanning')
                : detected > 0
                  ? t('device.detected', { count: detected })
                  : t('device.liveWaiting')}
            </span>
            <span className="status-chip__sep" aria-hidden="true" />
            <span className="status-chip__muted">{t('device.autoRefresh')}</span>
          </div>
        }
      />

      <div className="device-layout">
        <div className="device-column">
          {state.error ? (
            <section className="panel panel--alert">
              <div className="inline-note inline-note--warn">
                <AlertTriangle size={16} aria-hidden="true" />
                <div>
                  <strong>{t('device.errorTitle')}</strong>
                  <span>{state.error}</span>
                </div>
              </div>
              <p className="panel--alert__hint">{t('device.errorHint')}</p>
            </section>
          ) : null}

          {detected > 0 ? (
            <>
              <div className="device-list__head">
                <h2>{t('device.connectedTitle')}</h2>
                <span className="muted">{t('device.connectedHint')}</span>
              </div>
              <div className="device-list">
                {state.devices.map((device) => (
                  <DeviceCard key={device.id} device={device} />
                ))}
              </div>
            </>
          ) : (
            <section className="panel panel--hero">
              <div className="scanner" aria-hidden="true">
                <span className="scanner__ring scanner__ring--one" />
                <span className="scanner__ring scanner__ring--two" />
                <span className="scanner__ring scanner__ring--three" />
                <Smartphone size={46} strokeWidth={1.25} />
              </div>

              <div className="eyebrow">{t('device.emptyEyebrow')}</div>
              <h2 className="hero-title">
                {loading ? t('device.liveScanning') : t('device.emptyTitle')}
              </h2>
              <p className="hero-copy">{t('device.emptyBody')}</p>

              <div className="steps">
                <div className="step">
                  <span className="step__icon" aria-hidden="true">
                    <Cable size={17} />
                  </span>
                  <div>
                    <strong>{t('device.step1Title')}</strong>
                    <span>{t('device.step1Body')}</span>
                  </div>
                </div>
                <div className="step">
                  <span className="step__icon" aria-hidden="true">
                    <LockOpen size={17} />
                  </span>
                  <div>
                    <strong>{t('device.step2Title')}</strong>
                    <span>{t('device.step2Body')}</span>
                  </div>
                </div>
                <div className="step">
                  <span className="step__icon" aria-hidden="true">
                    <Usb size={17} />
                  </span>
                  <div>
                    <strong>{t('device.step3Title')}</strong>
                    <span>{t('device.step3Body')}</span>
                  </div>
                </div>
              </div>

              <div className="notice">
                <CircleDot size={14} aria-hidden="true" />
                <span>{t('device.ownership')}</span>
              </div>
            </section>
          )}
        </div>

        <aside className="panel panel--side">
          <div className="side-panel__header">
            <Usb size={17} aria-hidden="true" />
            <h3>{t('device.monitorTitle')}</h3>
          </div>
          <p>{t('device.monitorBody')}</p>

          <dl className="monitor-facts">
            <div>
              <dt>{t('device.lastScan')}</dt>
              <dd>{formatTime(state.scannedAt, lang)}</dd>
            </div>
            <div>
              <dt>{t('device.usbRecords')}</dt>
              <dd>{state.usbDevices}</dd>
            </div>
          </dl>

          <ul className="mode-list">
            {modes.map((mode) => (
              <li key={mode} className={activeModes.has(mode) ? 'is-active' : undefined}>
                <span className="mode-list__pulse" aria-hidden="true" />
                <span>{t(`device.mode.${mode}`)}</span>
                {activeModes.has(mode) ? (
                  <span className="mode-list__flag">{t('device.modePresent')}</span>
                ) : null}
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="button button--primary monitor-scan"
            onClick={() => void rescan()}
            disabled={scanning}
          >
            <RefreshCw size={14} className={scanning ? 'spin' : undefined} aria-hidden="true" />
            {scanning ? t('device.scanning') : t('device.scanNow')}
          </button>

          <div className="side-panel__footer">
            <span className="badge">{t('common.stage', { stage: 1 })}</span>
            <span className="muted">{t('device.live')}</span>
          </div>
        </aside>
      </div>
    </div>
  )
}
