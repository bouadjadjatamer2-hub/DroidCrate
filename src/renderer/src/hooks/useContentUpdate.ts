import { useCallback, useEffect, useState } from 'react'
import type {
  ContentApplyResult,
  ContentCheckResult,
  ContentStatus,
  ContentUpdateError
} from '@shared/contentUpdate'

interface ContentUpdateHook {
  status: ContentStatus | null
  result: ContentCheckResult | null
  loading: boolean
  checking: boolean
  applying: boolean
  restoring: boolean
  installedVersion: string | null
  restored: boolean
  error: string | null
  errorCode: ContentUpdateError | null
  check: () => Promise<void>
  apply: (version: string) => Promise<boolean>
  restore: () => Promise<boolean>
}

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

export function useContentUpdate(): ContentUpdateHook {
  const [status, setStatus] = useState<ContentStatus | null>(null)
  const [result, setResult] = useState<ContentCheckResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [applying, setApplying] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [installedVersion, setInstalledVersion] = useState<string | null>(null)
  const [restored, setRestored] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<ContentUpdateError | null>(null)

  useEffect(() => {
    let cancelled = false
    window.droidcrate
      .getContentStatus()
      .then((value) => {
        if (!cancelled) setStatus(value)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(describe(reason))
          setErrorCode('io')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const check = useCallback(async (): Promise<void> => {
    setChecking(true)
    setError(null)
    setErrorCode(null)
    setInstalledVersion(null)
    setRestored(false)
    try {
      const outcome = await window.droidcrate.checkContentUpdate()
      setResult(outcome)
      if (outcome.error) {
        setErrorCode(outcome.error)
        setError(outcome.message)
      }
    } catch (reason) {
      setError(describe(reason))
      setErrorCode('io')
    } finally {
      setChecking(false)
    }
  }, [])

  const apply = useCallback(async (version: string): Promise<boolean> => {
    setApplying(true)
    setError(null)
    setErrorCode(null)
    setInstalledVersion(null)
    setRestored(false)
    try {
      const outcome: ContentApplyResult = await window.droidcrate.applyContentUpdate(version)
      if (!outcome.installed) {
        setErrorCode(outcome.error)
        setError(outcome.message ?? 'The update was rejected.')
        return false
      }
      setStatus(await window.droidcrate.getContentStatus())
      setResult(null)
      setInstalledVersion(outcome.version)
      return true
    } catch (reason) {
      setError(describe(reason))
      setErrorCode('io')
      return false
    } finally {
      setApplying(false)
    }
  }, [])

  const restore = useCallback(async (): Promise<boolean> => {
    setRestoring(true)
    setError(null)
    setErrorCode(null)
    setInstalledVersion(null)
    try {
      setStatus(await window.droidcrate.resetContent())
      setResult(null)
      setRestored(true)
      return true
    } catch (reason) {
      setError(describe(reason))
      setErrorCode('io')
      return false
    } finally {
      setRestoring(false)
    }
  }, [])

  return {
    status,
    result,
    loading,
    checking,
    applying,
    restoring,
    installedVersion,
    restored,
    error,
    errorCode,
    check,
    apply,
    restore
  }
}


