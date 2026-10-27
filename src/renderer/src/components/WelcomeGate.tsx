import { useState } from 'react'
import {
  BookOpen,
  Cpu,
  ExternalLink,
  ListChecks,
  ShieldCheck,
  WifiOff
} from 'lucide-react'
import { PROJECT_URL } from '@shared/api'
import { useI18n } from '../i18n'

interface WelcomeGateProps {
  onAccept: () => void
}

const FEATURES = [
  { icon: Cpu, title: 'welcome.feature.devices.title', body: 'welcome.feature.devices.body' },
  { icon: BookOpen, title: 'welcome.feature.library.title', body: 'welcome.feature.library.body' },
  {
    icon: ListChecks,
    title: 'welcome.feature.checklists.title',
    body: 'welcome.feature.checklists.body'
  }
]

/**
 * First-run screen. It is not a legal contract; it is an explicit reminder of
 * the ownership rule the rest of the application enforces, shown once per
 * notice version before any device tool is reachable.
 */
export function WelcomeGate({ onAccept }: WelcomeGateProps) {
  const { t } = useI18n()
  const [ownsDevice, setOwnsDevice] = useState(false)
  const [understandsLimits, setUnderstandsLimits] = useState(false)
  const ready = ownsDevice && understandsLimits

  return (
    <div className="welcome">
      <div className="welcome__panel">
        <div className="welcome__head">
          <div className="welcome__mark" aria-hidden="true">
            <ShieldCheck size={26} />
          </div>
          <div>
            <span className="welcome__eyebrow">{t('welcome.eyebrow')}</span>
            <h1>{t('welcome.title')}</h1>
            <p className="welcome__lead">{t('welcome.lead')}</p>
          </div>
        </div>

        <div className="welcome__features">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <div className="welcome__feature" key={feature.title}>
                <Icon size={16} aria-hidden="true" />
                <div>
                  <strong>{t(feature.title)}</strong>
                  <span>{t(feature.body)}</span>
                </div>
              </div>
            )
          })}
          <div className="welcome__feature">
            <WifiOff size={16} aria-hidden="true" />
            <div>
              <strong>{t('welcome.feature.offline.title')}</strong>
              <span>{t('welcome.feature.offline.body')}</span>
            </div>
          </div>
        </div>

        <div className="welcome__legal">
          <h2>{t('welcome.legal.title')}</h2>
          <ul>
            <li>{t('welcome.legal.ownership')}</li>
            <li>{t('welcome.legal.bypass')}</li>
            <li>{t('welcome.legal.sources')}</li>
            <li>{t('welcome.legal.warranty')}</li>
          </ul>
        </div>

        <label className="gate-check welcome__check">
          <input
            type="checkbox"
            checked={ownsDevice}
            onChange={(event) => setOwnsDevice(event.target.checked)}
          />
          <span>{t('welcome.confirm.ownership')}</span>
        </label>
        <label className="gate-check welcome__check">
          <input
            type="checkbox"
            checked={understandsLimits}
            onChange={(event) => setUnderstandsLimits(event.target.checked)}
          />
          <span>{t('welcome.confirm.limits')}</span>
        </label>

        <div className="welcome__actions">
          <button
            type="button"
            className="button button--ghost"
            onClick={() => void window.droidcrate.openExternal(PROJECT_URL)}
          >
            {t('welcome.source')}
            <ExternalLink size={14} />
          </button>
          <button type="button" className="button button--primary" disabled={!ready} onClick={onAccept}>
            <ShieldCheck size={15} aria-hidden="true" />
            {t('welcome.accept')}
          </button>
        </div>
        <p className="welcome__note">{t('welcome.note')}</p>
      </div>
    </div>
  )
}
