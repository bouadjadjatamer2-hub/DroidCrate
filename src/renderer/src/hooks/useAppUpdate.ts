import { useCallback, useEffect, useState } from 'react'
import type { UpdateState } from '@shared/updates'

interface AppUpdateHook {
  state: UpdateState | null
  check: () => Promise<void>
  download: () => Promise<void>
  install: () => Promise<void>
  later: () => Promise<void>
  skip: () => Promise<void>
}

/**
 * One shared source of truth for the application updater. The main process
 * broadcasts every state change, so the prompt and the Settings card always
 * agree even when the window is busy.
 */
export function useAppUpdate(): AppUpdateHook {
  const [state, setState] = useState<UpdateState | null>(null)

  useEffect(() => {
    let cancelled = false
    window.droidcrate
      .getUpdateState()
      .then((value) => {
        if (!cancelled) setState(value)
      })
      .catch(() => {
        // Updates are optional; a missing bridge must not break the app.
      })
    const unsubscribe = window.droidcrate.onUpdateState((value) => setState(value))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const check = useCallback(async (): Promise<void> => {
    setState(await window.droidcrate.checkAppUpdate())
  }, [])

  const download = useCallback(async (): Promise<void> => {
    setState(await window.droidcrate.downloadAppUpdate())
  }, [])

  const install = useCallback(async (): Promise<void> => {
    await window.droidcrate.installAppUpdate()
  }, [])

  const later = useCallback(async (): Promise<void> => {
    setState(await window.droidcrate.laterAppUpdate())
  }, [])

  const skip = useCallback(async (): Promise<void> => {
    setState(await window.droidcrate.skipAppUpdate())
  }, [])

  return { state, check, download, install, later, skip }
}

export function isSnoozed(state: UpdateState | null, now: Date = new Date()): boolean {
  if (!state?.snoozedUntil) return false
  const until = new Date(state.snoozedUntil).getTime()
  return Number.isFinite(until) && until > now.getTime()
}

export function formatBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return '0 MB'
  const mb = value / (1024 * 1024)
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`
}
