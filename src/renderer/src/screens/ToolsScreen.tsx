import { useMemo, useState } from 'react'
import { AlertTriangle, Search, SearchX, SlidersHorizontal, X } from 'lucide-react'
import type { ToolCategory, ToolDifficulty } from '@shared/tools'
import { SectionHeader } from '../components/SectionHeader'
import { ToolCard } from '../components/ToolCard'
import { useToolLibrary } from '../hooks/useToolLibrary'
import { useI18n } from '../i18n'

type CategoryFilter = ToolCategory | 'all'
type DifficultyFilter = ToolDifficulty | 'all'

const categories: ToolCategory[] = ['platform', 'flashing', 'recovery', 'root', 'driver']

export function ToolsScreen() {
  const { t } = useI18n()
  const { library, loading, error } = useToolLibrary()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [brand, setBrand] = useState('all')
  const [chipset, setChipset] = useState('all')
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all')

  const tools = useMemo(() => library?.tools ?? [], [library])

  const brands = useMemo(
    () => [...new Set(tools.flatMap((tool) => tool.brands))].sort((a, b) => a.localeCompare(b)),
    [tools]
  )
  const chipsets = useMemo(
    () => [...new Set(tools.flatMap((tool) => tool.chipsets))].sort((a, b) => a.localeCompare(b)),
    [tools]
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return tools.filter((tool) => {
      if (category !== 'all' && tool.category !== category) return false
      if (brand !== 'all' && !tool.brands.includes(brand)) return false
      if (chipset !== 'all' && !tool.chipsets.includes(chipset)) return false
      if (difficulty !== 'all' && tool.difficulty !== difficulty) return false
      if (!needle) return true
      return [tool.name, tool.vendor, tool.summary, ...tool.brands, ...tool.chipsets]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [brand, category, chipset, difficulty, query, tools])

  const filtersActive =
    query.length > 0 || category !== 'all' || brand !== 'all' || chipset !== 'all' || difficulty !== 'all'

  function resetFilters(): void {
    setQuery('')
    setCategory('all')
    setBrand('all')
    setChipset('all')
    setDifficulty('all')
  }

  return (
    <div className="screen">
      <SectionHeader
        eyebrow={t('tools.eyebrow')}
        title={t('tools.title')}
        subtitle={t('tools.subtitle')}
        aside={
          <div className="status-chip">
            <span className="status-chip__dot" aria-hidden="true" />
            <span>{t('tools.count', { count: tools.length })}</span>
            <span className="status-chip__sep" aria-hidden="true" />
            <span className="status-chip__muted">{t('tools.officialOnly')}</span>
          </div>
        }
      />

      <section className="panel tool-toolbar">
        <div className="tool-toolbar__search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('tools.searchPlaceholder')}
            aria-label={t('tools.searchPlaceholder')}
          />
          {filtersActive ? (
            <button
              type="button"
              className="tool-toolbar__reset"
              onClick={resetFilters}
              aria-label={t('tools.reset')}
              title={t('tools.reset')}
            >
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="tool-toolbar__filters">
          <div className="chip-row">
            <button
              type="button"
              className={`chip chip--filter${category === 'all' ? ' is-active' : ''}`}
              onClick={() => setCategory('all')}
            >
              {t('tools.filter.all')}
            </button>
            {categories.map((value) => (
              <button
                key={value}
                type="button"
                className={`chip chip--filter${category === value ? ' is-active' : ''}`}
                onClick={() => setCategory(value)}
              >
                {t(`tools.category.${value}`)}
              </button>
            ))}
          </div>

          <div className="tool-selects">
            <label className="tool-select">
              <span>{t('tools.filter.brand')}</span>
              <select value={brand} onChange={(event) => setBrand(event.target.value)}>
                <option value="all">{t('tools.filter.all')}</option>
                {brands.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="tool-select">
              <span>{t('tools.filter.chipset')}</span>
              <select value={chipset} onChange={(event) => setChipset(event.target.value)}>
                <option value="all">{t('tools.filter.all')}</option>
                {chipsets.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="tool-select">
              <span>{t('tools.filter.difficulty')}</span>
              <select
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as DifficultyFilter)}
              >
                <option value="all">{t('tools.filter.all')}</option>
                <option value="beginner">{t('tools.difficulty.beginner')}</option>
                <option value="intermediate">{t('tools.difficulty.intermediate')}</option>
                <option value="advanced">{t('tools.difficulty.advanced')}</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="panel empty-state">
          <div className="empty-state__icon">
            <SlidersHorizontal size={26} aria-hidden="true" />
          </div>
          <h2>{t('tools.loading')}</h2>
        </section>
      ) : null}

      {error ? (
        <section className="panel empty-state">
          <div className="empty-state__icon">
            <AlertTriangle size={26} aria-hidden="true" />
          </div>
          <h2>{t('tools.errorTitle')}</h2>
          <p>{error}</p>
        </section>
      ) : null}

      {!loading && !error ? (
        <>
          <div className="library-summary">
            <span>{t('tools.results', { count: filtered.length, total: tools.length })}</span>
            <span className="muted">{t('tools.officialOnlyBody')}</span>
          </div>

          {filtered.length > 0 ? (
            <div className="tool-grid">
              {filtered.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          ) : (
            <section className="panel empty-state">
              <div className="empty-state__icon">
                <SearchX size={26} aria-hidden="true" />
              </div>
              <h2>{t('tools.emptyTitle')}</h2>
              <p>{t('tools.emptyBody')}</p>
              <div className="empty-state__extra">
                <button type="button" className="button button--primary" onClick={resetFilters}>
                  {t('tools.reset')}
                </button>
              </div>
            </section>
          )}
        </>
      ) : null}
    </div>
  )
}
