import { Database, ExternalLink, Info, Languages, ShieldAlert } from 'lucide-react'
import type { AppInfo } from '@shared/api'
import { PROJECT_URL } from '@shared/api'
import { SectionHeader } from '../components/SectionHeader'
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
