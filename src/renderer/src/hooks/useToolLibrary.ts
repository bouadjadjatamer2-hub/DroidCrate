import { useEffect, useState } from 'react'
import type { ToolLibrary } from '@shared/tools'

interface ToolLibraryState {
  library: ToolLibrary | null
  loading: boolean
  error: string | null
}

export function useToolLibrary(): ToolLibraryState {
  const [library, setLibrary] = useState<ToolLibrary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    window.droidcrate
      .getToolLibrary()
      .then((value) => {
        if (!cancelled) setLibrary(value)
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Tool library unavailable')
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
