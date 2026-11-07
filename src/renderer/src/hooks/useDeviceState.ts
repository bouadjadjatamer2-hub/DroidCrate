import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeviceState } from '@shared/device'

const initialState: DeviceState = {
  devices: [],
  scannedAt: '',
  error: null,
  usbDevices: 0,
  adb: { installed: false, ok: false, error: null }
}

export interface DeviceStateResult {
  state: DeviceState
  loading: boolean
  scanning: boolean
  rescan: () => Promise<void>
}

export function useDeviceState(): DeviceStateResult {
  const [state, setState] = useState<DeviceState>(initialState)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    let cancelled = false

    const unsubscribe = window.droidcrate.onDeviceUpdate((next) => {
      if (cancelled) return
      setState(next)
      setLoading(false)
    })

    window.droidcrate
      .getDeviceState()
      .then((next) => {
        if (!cancelled) setState(next)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            ...initialState,
            error: error instanceof Error ? error.message : 'Device bridge unavailable'
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    // Coming back to the window is a strong hint that a cable was just
    // plugged in, so ask the main process for an immediate scan.
    const onFocus = (): void => {
      void window.droidcrate.rescanDevices().catch(() => undefined)
    }
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      mounted.current = false
      window.removeEventListener('focus', onFocus)
      unsubscribe()
    }
  }, [])

  const rescan = useCallback(async (): Promise<void> => {
    setScanning(true)
    try {
      const next = await window.droidcrate.rescanDevices()
      if (mounted.current) setState(next)
    } catch (error) {
      if (mounted.current) {
        setState({
          ...initialState,
          error: error instanceof Error ? error.message : 'Device bridge unavailable'
        })
      }
    } finally {
      if (mounted.current) setScanning(false)
    }
  }, [])

  return { state, loading, scanning, rescan }
}
