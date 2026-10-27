import { Box, WifiOff } from 'lucide-react'
import { useI18n } from '../i18n'

export function Titlebar({ version }: { version: string }) {
  const { t } = useI18n()
  return (
    <header className="titlebar">
      <div className="titlebar__identity">
        <span className="mark" aria-hidden="true">
          <Box size={16} strokeWidth={2.2} />
        </span>
        <span className="titlebar__name">{t('app.name')}</span>
        <span className="titlebar__divider" aria-hidden="true" />
        <span className="titlebar__tagline">{t('app.tagline')}</span>
      </div>
      <div className="titlebar__meta">
        <span className="badge badge--quiet">
          <WifiOff size={12} />
          {t('app.offline')}
        </span>
        <span className="titlebar__version">v{version}</span>
      </div>
    </header>
  )
}
