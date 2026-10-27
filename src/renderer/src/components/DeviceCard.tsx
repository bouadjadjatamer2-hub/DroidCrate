import { AlertTriangle, ArrowUpRight, Download, Smartphone, Usb } from 'lucide-react'
import type { DetectedDevice } from '@shared/device'
import { useI18n } from '../i18n'

function openLink(url: string): void {
  void window.droidcrate.openExternal(url)
}

export function DeviceCard({ device }: { device: DetectedDevice }) {
  const { t } = useI18n()
  const hasMode = device.mode !== 'unknown'

  return (
    <article className="device-card">
      <div className="device-card__head">
        <span className="device-card__icon" aria-hidden="true">
          <Smartphone size={22} strokeWidth={1.4} />
        </span>
        <div className="device-card__identity">
          <span className="device-card__brand">
            {device.brand || t('device.unknownBrand')}
          </span>
          <h2>{device.model ?? t('device.modelUnknown')}</h2>
        </div>
        <span className={`mode-badge mode-badge--${device.mode}`}>
          {t(`device.mode.${device.mode}`)}
        </span>
      </div>

      <dl className="device-facts">
        <div>
          <dt>{t('device.usbId')}</dt>
          <dd>{device.usbId}</dd>
        </div>
        <div>
          <dt>{t('device.match')}</dt>
          <dd>
            <span className={`confidence confidence--${device.confidence}`}>
              {t(`device.confidence.${device.confidence}`)}
            </span>
          </dd>
        </div>
        <div>
          <dt>{t('device.rule')}</dt>
          <dd>{device.ruleId ?? t('device.ruleNone')}</dd>
        </div>
      </dl>

      {device.note ? <p className="device-card__note">{device.note}</p> : null}

      {device.names.length > 0 ? (
        <div className="device-card__names">
          <Usb size={13} aria-hidden="true" />
          <div className="chip-row">
            {device.names.map((name) => (
              <span key={name} className="chip chip--tiny">
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {!hasMode ? (
        <div className="inline-note inline-note--warn">
          <AlertTriangle size={15} aria-hidden="true" />
          <div>
            <strong>{t('device.unknownModeTitle')}</strong>
            <span>{t('device.unknownModeBody')}</span>
          </div>
        </div>
      ) : null}

      {device.tool || device.driver ? (
        <div className="device-card__tools">
          {device.tool ? (
            <div className="tool-suggestion">
              <div className="tool-suggestion__copy">
                <span className="tool-suggestion__label">{t('device.suggestedTool')}</span>
                <strong>{device.tool.name}</strong>
                {device.tool.note ? <span>{device.tool.note}</span> : null}
              </div>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => openLink(device.tool!.url)}
              >
                {device.tool.linkKind === 'download' ? (
                  <Download size={14} aria-hidden="true" />
                ) : (
                  <ArrowUpRight size={14} aria-hidden="true" />
                )}
                {device.tool.linkKind === 'download'
                  ? t('device.officialDownload')
                  : t('device.supportPage')}
              </button>
            </div>
          ) : null}

          {device.driver ? (
            <button
              type="button"
              className="link-button"
              onClick={() => openLink(device.driver!.url)}
            >
              <ArrowUpRight size={13} aria-hidden="true" />
              {t('device.driverLink', { name: device.driver.name })}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
