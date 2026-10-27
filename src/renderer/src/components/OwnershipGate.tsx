import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import type { Checklist } from '@shared/checklists'
import { useI18n } from '../i18n'

interface OwnershipGateProps {
  checklist: Checklist
  onCancel: () => void
  onConfirm: () => void
}

export function OwnershipGate({ checklist, onCancel, onConfirm }: OwnershipGateProps) {
  const { t } = useI18n()
  const [ownsDevice, setOwnsDevice] = useState(false)
  const [understandsRisk, setUnderstandsRisk] = useState(false)
  const ready = ownsDevice && understandsRisk

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="gate-title">
        <div className="modal__icon">
          <ShieldAlert size={24} aria-hidden="true" />
        </div>
        <div className={`risk risk--${checklist.risk} modal__risk`}>
          {t(`checklists.risk.${checklist.risk}`)}
        </div>
        <h2 id="gate-title">{t('checklists.gate.title')}</h2>
        <p className="modal__body">
          {t('checklists.gate.body', { operation: checklist.title })}
        </p>

        <div className="modal__warning">{checklist.warning}</div>

        <label className="gate-check">
          <input
            type="checkbox"
            checked={ownsDevice}
            onChange={(event) => setOwnsDevice(event.target.checked)}
          />
          <span>{t('checklists.gate.ownership')}</span>
        </label>
        <label className="gate-check">
          <input
            type="checkbox"
            checked={understandsRisk}
            onChange={(event) => setUnderstandsRisk(event.target.checked)}
          />
          <span>{t('checklists.gate.risk')}</span>
        </label>

        <div className="modal__actions">
          <button type="button" className="button button--ghost" onClick={onCancel}>
            {t('checklists.gate.cancel')}
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={onConfirm}
            disabled={!ready}
          >
            {t('checklists.gate.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
