import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlatformToolsStatus } from '@shared/platformTools'
import {
  ADB_ACTIONS,
  type AdbActionId,
  type AdbActionResult,
  type AdbDevice,
  type AdbLogEntry
} from '@shared/adb'

export interface AdbWorkspace {
  status: PlatformToolsStatus | null
  statusLoading: boolean
  adbDevices: AdbDevice[]
  fastbootDevices: AdbDevice[]
  adbError: string | null
  fastbootError: string | null
  selectedSerial: string | null
  selectedFastboot: string | null
  selectSerial: (serial: string) => void
  selectFastboot: (serial: string) => void
  log: AdbLogEntry[]
  busyAction: AdbActionId | null
  refreshing: boolean
  fastbootScanning: boolean
  installing: boolean
  bridgeError: string | null
  install: () => Promise<void>
  cancelInstall: () => Promise<void>
  recheck: () => Promise<void>
  refreshDevices: () => Promise<void>
  scanFastboot: () => Promise<void>
  runAction: (action: AdbActionId, confirmed?: boolean) => Promise<AdbActionResult | null>
  clearLog: () => Promise<void>
}

export function useAdbWorkspace(): AdbWorkspace {
  const [status, setStatus] = useState<PlatformToolsStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [adbDevices, setAdbDevices] = useState<AdbDevice[]>([])
  const [fastbootDevices, setFastbootDevices] = useState<AdbDevice[]>([])
  const [adbError, setAdbError] = useState<string | null>(null)
  const [fastbootError, setFastbootError] = useState<string | null>(null)
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null)
  const [selectedFastboot, setSelectedFastboot] = useState<string | null>(null)
  const [log, setLog] = useState<AdbLogEntry[]>([])
  const [busyAction, setBusyAction] = useState<AdbActionId | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [fastbootScanning, setFastbootScanning] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [bridgeError, setBridgeError] = useState<string | null>(null)
  const readyRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const loadDevices = useCallback(async (announce: boolean): Promise<void> => {
    if (announce) setRefreshing(true)
    try {
      const result = await window.droidcrate.listAdbDevices('adb')
      if (!mountedRef.current) return
      setAdbDevices(result.devices)
      setAdbError(result.ok ? null : result.error)
    } catch (error) {
      if (!mountedRef.current) return
      setAdbError(error instanceof Error ? error.message : 'ADB bridge unavailable')
    } finally {
      if (mountedRef.current && announce) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const offStatus = window.droidcrate.onPlatformToolsUpdate((next) => {
      if (cancelled) return
      setStatus(next)
      setInstalling(
        next.stage === 'downloading' ||
          next.stage === 'verifying' ||
          next.stage === 'extracting' ||
          next.stage === 'installing'
      )
    })
    const offLog = window.droidcrate.onAdbLog((entry) => {
      if (cancelled) return
      setLog((previous) => [entry, ...previous].slice(0, 100))
    })

    Promise.all([window.droidcrate.getPlatformToolsStatus(), window.droidcrate.getAdbLog()])
      .then(([nextStatus, entries]) => {
        if (cancelled) return
        setStatus(nextStatus)
        setLog(entries)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setBridgeError(error instanceof Error ? error.message : 'Native bridge unavailable')
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false)
      })

    return () => {
      cancelled = true
      offStatus()
      offLog()
    }
  }, [])

  useEffect(() => {
    const ready = status?.installed === true
    if (!ready) {
      readyRef.current = false
      setAdbDevices([])
      setFastbootDevices([])
      return
    }
    if (readyRef.current) return
    readyRef.current = true
    void loadDevices(false)
  }, [loadDevices, status?.installed])

  useEffect(() => {
    if (!status?.installed) return
    const timer = setInterval(() => void loadDevices(false), 5_000)
    return () => clearInterval(timer)
  }, [loadDevices, status?.installed])

  useEffect(() => {
    setSelectedSerial((previous) => {
      if (previous && adbDevices.some((device) => device.serial === previous)) return previous
      return adbDevices.find((device) => device.state === 'device')?.serial ?? adbDevices[0]?.serial ?? null
    })
  }, [adbDevices])

  useEffect(() => {
    setSelectedFastboot((previous) => {
      if (previous && fastbootDevices.some((device) => device.serial === previous)) return previous
      return fastbootDevices[0]?.serial ?? null
    })
  }, [fastbootDevices])

  const refreshDevices = useCallback(async (): Promise<void> => {
    await loadDevices(true)
  }, [loadDevices])

  const scanFastboot = useCallback(async (): Promise<void> => {
    setFastbootScanning(true)
    try {
      const result = await window.droidcrate.listAdbDevices('fastboot')
      if (!mountedRef.current) return
      setFastbootDevices(result.devices)
      setFastbootError(result.ok ? null : result.error)
    } catch (error) {
      if (!mountedRef.current) return
      setFastbootError(error instanceof Error ? error.message : 'Fastboot bridge unavailable')
    } finally {
      if (mountedRef.current) setFastbootScanning(false)
    }
  }, [])

  const install = useCallback(async (): Promise<void> => {
    setInstalling(true)
    setBridgeError(null)
    try {
      const next = await window.droidcrate.installPlatformTools()
      if (!mountedRef.current) return
      setStatus(next)
      setInstalling(false)
    } catch (error) {
      if (!mountedRef.current) return
      setInstalling(false)
      setBridgeError(error instanceof Error ? error.message : 'Installer bridge unavailable')
    }
  }, [])

  const cancelInstall = useCallback(async (): Promise<void> => {
    await window.droidcrate.cancelPlatformToolsInstall().catch(() => undefined)
  }, [])

  const recheck = useCallback(async (): Promise<void> => {
    try {
      const next = await window.droidcrate.recheckPlatformTools()
      if (mountedRef.current) setStatus(next)
    } catch (error) {
      if (mountedRef.current) {
        setBridgeError(error instanceof Error ? error.message : 'Installer bridge unavailable')
      }
    }
  }, [])

  const runAction = useCallback(
    async (action: AdbActionId, confirmed = false): Promise<AdbActionResult | null> => {
      const definition = ADB_ACTIONS[action]
      const serial = definition.requiresSerial
        ? definition.tool === 'adb'
          ? selectedSerial
          : selectedFastboot
        : null

      if (definition.requiresSerial && !serial) {
        setBridgeError('Select a connected device first.')
        return null
      }

      setBusyAction(action)
      setBridgeError(null)
      try {
        const result = await window.droidcrate.runAdbAction(action, serial, confirmed)
        if (mountedRef.current) {
          if (result.error) setBridgeError(result.error)
          void loadDevices(false)
          if (definition.tool === 'fastboot') void scanFastboot()
        }
        return result
      } catch (error) {
        if (mountedRef.current) {
          setBridgeError(error instanceof Error ? error.message : 'ADB bridge unavailable')
        }
        return null
      } finally {
        if (mountedRef.current) setBusyAction(null)
      }
    },
    [loadDevices, scanFastboot, selectedFastboot, selectedSerial]
  )

  const clearLog = useCallback(async (): Promise<void> => {
    await window.droidcrate.clearAdbLog()
    if (mountedRef.current) setLog([])
  }, [])

  return {
    status,
    statusLoading,
    adbDevices,
    fastbootDevices,
    adbError,
    fastbootError,
    selectedSerial,
    selectedFastboot,
    selectSerial: setSelectedSerial,
    selectFastboot: setSelectedFastboot,
    log,
    busyAction,
    refreshing,
    fastbootScanning,
    installing,
    bridgeError,
    install,
    cancelInstall,
    recheck,
    refreshDevices,
    scanFastboot,
    runAction,
    clearLog
  }
}
