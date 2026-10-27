import { Cable, CircleDot, LockOpen, Smartphone, Usb } from 'lucide-react'
import { SectionHeader } from '../components/SectionHeader'
import { useI18n } from '../i18n'

const modes = ['adb', 'fastboot', 'download', 'edl', 'brom'] as const

export function DeviceScreen() {
  const { t } = useI18n()

  return (
    <div className="screen">
      <SectionHeader
        eyebrow={t('device.eyebrow')}
        title={t('device.title')}
        subtitle={t('device.subtitle')}
        aside={
          <div className="status-chip">
            <span className="status-chip__dot" aria-hidden="true" />
            <span>{t('device.waiting')}</span>
            <span className="status-chip__sep" aria-hidden="true" />
            <span className="status-chip__muted">{t('device.stageNote')}</span>
          </div>
        }
      />

      <div className="device-layout">
        <section className="panel panel--hero">
          <div className="scanner" aria-hidden="true">
            <span className="scanner__ring scanner__ring--one" />
            <span className="scanner__ring scanner__ring--two" />
            <span className="scanner__ring scanner__ring--three" />
            <Smartphone size={46} strokeWidth={1.25} />
          </div>

          <div className="eyebrow">{t('device.emptyEyebrow')}</div>
          <h2 className="hero-title">{t('device.emptyTitle')}</h2>
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

        <aside className="panel panel--side">
          <div className="side-panel__header">
            <Usb size={17} aria-hidden="true" />
            <h3>{t('device.recogniseTitle')}</h3>
          </div>
          <p>{t('device.recogniseBody')}</p>
          <ul className="mode-list">
            {modes.map((mode) => (
              <li key={mode}>
                <span className="mode-list__pulse" aria-hidden="true" />
                <span>{t(`device.mode.${mode}`)}</span>
              </li>
            ))}
          </ul>
          <div className="side-panel__footer">
            <span className="badge">{t('common.stage', { stage: 1 })}</span>
            <span className="muted">{t('common.comingSoon')}</span>
          </div>
        </aside>
      </div>
    </div>
  )
}
