import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Code2,
  Download,
  LifeBuoy
} from 'lucide-react'
import type { ToolEntry, ToolLinkKind } from '@shared/tools'
import { useI18n } from '../i18n'

const linkIcons: Record<ToolLinkKind, typeof Download> = {
  download: Download,
  source: Code2,
  guide: BookOpen,
  support: LifeBuoy
}

function openLink(url: string): void {
  void window.droidcrate.openExternal(url)
}

export function ToolCard({ tool }: { tool: ToolEntry }) {
  const { t } = useI18n()

  return (
    <article className="tool-card">
      <div className="tool-card__head">
        <div className="tool-card__identity">
          <span className="tool-card__vendor">{tool.vendor}</span>
          <h2>{tool.name}</h2>
        </div>
        <span className={`availability availability--${tool.availability}`}>
          {t(`tools.availability.${tool.availability}`)}
        </span>
      </div>

      <p className="tool-card__summary">{tool.summary}</p>

      <div className="tool-card__meta">
        <span>{t(`tools.category.${tool.category}`)}</span>
        <span className="dot" aria-hidden="true" />
        <span>{t(`tools.difficulty.${tool.difficulty}`)}</span>
        <span className="dot" aria-hidden="true" />
        <span>{tool.platforms.map((platform) => t(`tools.platform.${platform}`)).join(' / ')}</span>
      </div>

      <div className="chip-row tool-card__chips">
        {tool.chipsets.map((chipset) => (
          <span key={chipset} className="chip chip--tiny">
            {chipset}
          </span>
        ))}
        {tool.brands.slice(0, 4).map((brand) => (
          <span key={brand} className="chip chip--tiny chip--plain">
            {brand}
          </span>
        ))}
      </div>

      {tool.warning ? (
        <div className="inline-note inline-note--warn tool-card__warning">
          <AlertTriangle size={14} aria-hidden="true" />
          <div>
            <strong>{t('tools.warning')}</strong>
            <span>{tool.warning}</span>
          </div>
        </div>
      ) : null}

      <ul className="tool-card__notes">
        {tool.notes.slice(0, 2).map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>

      <div className="tool-card__links">
        {tool.links.map((link) => {
          const Icon = linkIcons[link.kind]
          return (
            <button
              key={link.url}
              type="button"
              className="button button--ghost tool-link"
              onClick={() => openLink(link.url)}
            >
              <Icon size={13} aria-hidden="true" />
              {link.label}
              <ArrowUpRight size={11} aria-hidden="true" />
            </button>
          )
        })}
      </div>
    </article>
  )
}
