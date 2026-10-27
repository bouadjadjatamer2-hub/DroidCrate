import { useCallback, useEffect, useRef, useState } from 'react'
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

const LEGACY_STORAGE_KEY = 'droidcrate.checklists.v1'

function readLegacyProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return {}
    const result: ProgressMap = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'object' || value === null) continue
      const record = value as { checked?: unknown; completedAt?: unknown }
      if (!Array.isArray(record.checked)) continue
      result[key] = {
        checked: record.checked.filter((item): item is string => typeof item === 'string'),
        completedAt: typeof record.completedAt === 'string' ? record.completedAt : null
      }
    }
    return result
  } catch {
    return {}
  }
}

export interface ChecklistProgressApi {
  progress: ProgressMap
  loading: boolean
  error: string | null
  toggle: (checklistId: string, itemId: string) => void
  complete: (checklistId: string) => void
  reset: (checklistId: string) => void
}

/**
 * Checklist state now lives in SQLite. Progress saved by earlier versions in
 * localStorage is imported once, then the old key is removed.
 */
export function useChecklistProgress(): ChecklistProgressApi {
  const [progress, setProgress] = useState<ProgressMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const progressRef = useRef<ProgressMap>({})

  function apply(next: ProgressMap): void {
    progressRef.current = next
    setProgress(next)
  }

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      try {
        let stored = await window.droidcrate.getChecklistProgress()
        if (Object.keys(stored).length === 0) {
          const legacy = readLegacyProgress()
          if (Object.keys(legacy).length > 0) {
            const imported = await window.droidcrate.importChecklistProgress(legacy)
            if (imported > 0) {
              stored = await window.droidcrate.getChecklistProgress()
              localStorage.removeItem(LEGACY_STORAGE_KEY)
            }
          }
        }
        if (cancelled) return
        apply(stored)
      } catch (reason) {
        if (cancelled) return
        setError(reason instanceof Error ? reason.message : 'Checklist storage unavailable')
        apply(readLegacyProgress())
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback(
    async (checklistId: string, record: ChecklistProgress): Promise<void> => {
      try {
        const stored = await window.droidcrate.saveChecklistProgress(
          checklistId,
          record.checked,
          record.completedAt
        )
        apply(stored)
        setError(null)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Could not save checklist progress')
      }
    },
    []
  )

  const toggle = useCallback(
    (checklistId: string, itemId: string): void => {
      const entry = progressRef.current[checklistId] ?? { checked: [], completedAt: null }
      const checked = entry.checked.includes(itemId)
        ? entry.checked.filter((id) => id !== itemId)
        : [...entry.checked, itemId]
      const next = { checked, completedAt: null }
      apply({ ...progressRef.current, [checklistId]: next })
      void persist(checklistId, next)
    },
    [persist]
  )

  const complete = useCallback(
    (checklistId: string): void => {
      const entry = progressRef.current[checklistId] ?? { checked: [], completedAt: null }
      const next = { ...entry, completedAt: new Date().toISOString() }
      apply({ ...progressRef.current, [checklistId]: next })
      void persist(checklistId, next)
    },
    [persist]
  )

  const reset = useCallback((checklistId: string): void => {
    const next = { ...progressRef.current }
    delete next[checklistId]
    apply(next)
    window.droidcrate
      .resetChecklistProgress(checklistId)
      .then((stored) => apply(stored))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Could not reset checklist progress')
      })
  }, [])

  return { progress, loading, error, toggle, complete, reset }
}
