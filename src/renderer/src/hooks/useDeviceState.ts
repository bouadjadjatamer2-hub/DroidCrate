import { useCallback, useEffect, useState } from 'react'
import type { DeviceState } from '@shared/device'

const initialState: DeviceState = {
  devices: [],
  scannedAt: '',
  error: null,
  usbDevices: 0
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

  useEffect(() => {
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

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const rescan = useCallback(async (): Promise<void> => {
    setScanning(true)
    try {
      setState(await window.droidcrate.rescanDevices())
    } catch (error) {
      setState({
        ...initialState,
        error: error instanceof Error ? error.message : 'Device bridge unavailable'
      })
    } finally {
      setScanning(false)
    }
  }, [])

  return { state, loading, scanning, rescan }
}
