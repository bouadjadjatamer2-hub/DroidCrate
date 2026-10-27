import { useCallback, useEffect, useState } from 'react'
import type { ChecklistLibrary } from '@shared/checklists'

interface ChecklistLibraryState {
  library: ChecklistLibrary | null
  loading: boolean
  error: string | null
}

export function useChecklistLibrary(): ChecklistLibraryState {
  const [library, setLibrary] = useState<ChecklistLibrary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    window.droidcrate
      .getChecklistLibrary()
      .then((value) => {
        if (!cancelled) setLibrary(value)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Checklist library unavailable')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { library, loading, error }
}

export interface ChecklistProgress {
  checked: string[]
  completedAt: string | null
}

type ProgressMap = Record<string, ChecklistProgress>

const STORAGE_KEY = 'droidcrate.checklists.v1'

function readProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as ProgressMap
  } catch {
    return {}
  }
}

export interface ChecklistProgressApi {
  progress: ProgressMap
  toggle: (checklistId: string, itemId: string) => void
  complete: (checklistId: string) => void
  reset: (checklistId: string) => void
}

export function useChecklistProgress(): ChecklistProgressApi {
  const [progress, setProgress] = useState<ProgressMap>(readProgress)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    } catch {
      // Storage may be unavailable; the checklist still works for this session.
    }
  }, [progress])

  const toggle = useCallback((checklistId: string, itemId: string) => {
    setProgress((current) => {
      const entry = current[checklistId] ?? { checked: [], completedAt: null }
      const checked = entry.checked.includes(itemId)
        ? entry.checked.filter((id) => id !== itemId)
        : [...entry.checked, itemId]
      return {
        ...current,
        [checklistId]: { checked, completedAt: null }
      }
    })
  }, [])

  const complete = useCallback((checklistId: string) => {
    setProgress((current) => {
      const entry = current[checklistId] ?? { checked: [], completedAt: null }
      return {
        ...current,
        [checklistId]: { ...entry, completedAt: new Date().toISOString() }
      }
    })
  }, [])

  const reset = useCallback((checklistId: string) => {
    setProgress((current) => {
      const next = { ...current }
      delete next[checklistId]
      return next
    })
  }, [])

  return { progress, toggle, complete, reset }
}
