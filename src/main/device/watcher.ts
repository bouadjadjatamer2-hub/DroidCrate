import { BrowserWindow } from 'electron'
import { IPC } from '@shared/api'
import type { DeviceState, UsbScan } from '@shared/device'
import { detectDevices } from '@shared/deviceMatcher'
import { loadDeviceRules } from './rules'
import { scanUsbDevices } from './usbScan'

const POLL_INTERVAL_MS = 3_000

const emptyState = (): DeviceState => ({
  devices: [],
  scannedAt: '',
  error: null,
  usbDevices: 0
})

export class DeviceWatcher {
  private state: DeviceState = emptyState()
  private timer: NodeJS.Timeout | null = null
  private started = false
  private pending: Promise<DeviceState> | null = null

  start(): void {
    if (this.started) return
    this.started = true
    void this.scanNow()
  }

  stop(): void {
    this.started = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  getState(): DeviceState {
    return this.state
  }

  scanNow(): Promise<DeviceState> {
    if (this.pending) return this.pending
    this.pending = this.runScan().finally(() => {
      this.pending = null
    })
    return this.pending
  }

  private async runScan(): Promise<DeviceState> {
    try {
      const [rules, records] = await Promise.all([loadDeviceRules(), scanUsbDevices()])
      const scannedAt = new Date().toISOString()
      const scan: UsbScan = { devices: records, scannedAt }
      const devices = detectDevices(scan, rules)
      this.state = {
        devices,
        scannedAt,
        error: null,
        usbDevices: records.length
      }
    } catch (error) {
      this.state = {
        devices: [],
        scannedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown USB scan error',
        usbDevices: 0
      }
    }

    this.broadcast()
    this.schedule()
    return this.state
  }

  private schedule(): void {
    if (!this.started) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.scanNow(), POLL_INTERVAL_MS)
  }

  private broadcast(): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC.deviceUpdate, this.state)
      }
    }
  }
}
