import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useI18n } from '../i18n'

interface RestartGateProps {
  actionLabel: string
  serial: string
  onCancel: () => void
  onConfirm: () => void
}

export function RestartGate({ actionLabel, serial, onCancel, onConfirm }: RestartGateProps) {
  const { t } = useI18n()
  const [ownsDevice, setOwnsDevice] = useState(false)
  const [understandsRisk, setUnderstandsRisk] = useState(false)
  const ready = ownsDevice && understandsRisk

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="restart-gate-title">
        <div className="modal__icon">
          <ShieldAlert size={24} aria-hidden="true" />
        </div>
        <div className="risk risk--medium modal__risk">{t('adb.gate.badge')}</div>
        <h2 id="restart-gate-title">{t('adb.gate.title')}</h2>
        <p className="modal__body">{t('adb.gate.body', { action: actionLabel, serial })}</p>

        <div className="modal__warning">{t('adb.gate.warning')}</div>

        <label className="gate-check">
          <input
            type="checkbox"
            checked={ownsDevice}
            onChange={(event) => setOwnsDevice(event.target.checked)}
          />
          <span>{t('adb.gate.ownership')}</span>
        </label>
        <label className="gate-check">
          <input
            type="checkbox"
            checked={understandsRisk}
            onChange={(event) => setUnderstandsRisk(event.target.checked)}
          />
          <span>{t('adb.gate.risk')}</span>
        </label>

        <div className="modal__actions">
          <button type="button" className="button button--ghost" onClick={onCancel}>
            {t('adb.gate.cancel')}
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={onConfirm}
            disabled={!ready}
          >
            {t('adb.gate.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
