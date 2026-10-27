import { useCallback, useEffect, useState } from 'react'
import type { HistoryEntry, HistoryExportResult } from '@shared/history'

interface HistoryHook {
  entries: HistoryEntry[]
  loading: boolean
  error: string | null
  exporting: 'txt' | 'csv' | null
  clear: () => Promise<void>
  exportAs: (format: 'txt' | 'csv') => Promise<HistoryExportResult | null>
}

export function useHistory(): HistoryHook {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'txt' | 'csv' | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const list = await window.droidcrate.getHistory()
      setEntries(list)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'History storage unavailable')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const clear = useCallback(async (): Promise<void> => {
    await window.droidcrate.clearHistory()
    setEntries([])
  }, [])

  const exportAs = useCallback(
    async (format: 'txt' | 'csv'): Promise<HistoryExportResult | null> => {
      setExporting(format)
      try {
        return await window.droidcrate.exportHistory(format)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Export failed')
        return null
      } finally {
        setExporting(null)
      }
    },
    []
  )

  return { entries, loading, error, exporting, clear, exportAs }
}
