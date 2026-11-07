import { BrowserWindow } from 'electron'
import { IPC } from '@shared/api'
import type { AdbDevice, DeviceSummary } from '@shared/adb'
import type { DeviceState, UsbDeviceRecord, UsbScan } from '@shared/device'
import { mergeDevices } from '@shared/deviceMatcher'
import type { AdbService } from '../adb/service'
import { loadDeviceRules } from './rules'
import { scanUsbDevices } from './usbScan'

/** adb answers in milliseconds, so a short poll makes plugging feel instant. */
const POLL_INTERVAL_MS = 1_500
/** The PowerShell USB inventory is slower; refresh it less often. */
const USB_SCAN_INTERVAL_MS = 6_000
const FASTBOOT_SCAN_INTERVAL_MS = 8_000
const SUMMARY_TTL_MS = 45_000
const SUMMARY_RETRY_MS = 10_000
const ADB_TIMEOUT_MS = 8_000

const emptyState = (): DeviceState => ({
  devices: [],
  scannedAt: '',
  error: null,
  usbDevices: 0,
  adb: { installed: false, ok: false, error: null }
})

interface SummaryCacheEntry {
  at: number
  value: DeviceSummary | null
}

export class DeviceWatcher {
  private state: DeviceState = emptyState()
  private timer: NodeJS.Timeout | null = null
  private started = false
  private pending: Promise<DeviceState> | null = null
  private adb: AdbService | null = null

  private usbRecords: UsbDeviceRecord[] = []
  private usbScannedAt = 0
  private fastbootDevices: AdbDevice[] = []
  private fastbootScannedAt = 0
  private summaries = new Map<string, SummaryCacheEntry>()
  private forceUsb = false
  private usbError: string | null = null

  /** The adb service owns the verified binaries and the serial checks. */
  attachAdb(adb: AdbService): void {
    this.adb = adb
    void this.scanNow(true)
  }

  start(): void {
    if (this.started) return
    this.started = true
    void this.scanNow(true)
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

  /**
   * Runs a scan immediately. A manual scan also forces the slower USB
   * inventory, so pressing "Scan now" always reflects the current cable.
   */
  scanNow(forceUsb = true): Promise<DeviceState> {
    if (forceUsb) this.forceUsb = true
    if (this.pending) return this.pending
    this.pending = this.runScan().finally(() => {
      this.pending = null
    })
    return this.pending
  }

  private async runScan(): Promise<DeviceState> {
    const forceUsb = this.forceUsb

    let adbDevices: AdbDevice[] = []
    let adbInstalled = false
    let adbOk = false
    let adbError: string | null = null

    try {
      adbInstalled = this.adb?.isReady() ?? false
      const now = Date.now()
      const usbDue =
        forceUsb || this.usbScannedAt === 0 || now - this.usbScannedAt >= USB_SCAN_INTERVAL_MS

      const usbPromise = usbDue
        ? scanUsbDevices()
            .then((records) => {
              this.usbRecords = records
              this.usbError = null
              this.usbScannedAt = Date.now()
            })
            .catch((error: unknown) => {
              this.usbError =
                error instanceof Error ? error.message : 'Unknown USB scan error'
              this.usbScannedAt = Date.now()
            })
        : Promise.resolve()

      if (adbInstalled && this.adb) {
        const result = await this.adb.listDevices('adb', ADB_TIMEOUT_MS)
        adbDevices = result.devices
        adbOk = result.ok
        adbError = result.ok ? null : result.error
        await this.refreshSummaries(adbDevices)
      }

      await usbPromise

      const fastbootDue =
        forceUsb ||
        this.fastbootScannedAt === 0 ||
        Date.now() - this.fastbootScannedAt >= FASTBOOT_SCAN_INTERVAL_MS
      if (adbInstalled && this.adb && adbDevices.length === 0 && fastbootDue) {
        const result = await this.adb.listDevices('fastboot', ADB_TIMEOUT_MS)
        this.fastbootDevices = result.devices
        this.fastbootScannedAt = Date.now()
      } else if (adbDevices.length > 0) {
        this.fastbootDevices = []
        this.fastbootScannedAt = 0
      }

      const rules = await loadDeviceRules()
      const scannedAt = new Date().toISOString()
      const scan: UsbScan = { devices: this.usbRecords, scannedAt }
      const summaries: Record<string, DeviceSummary> = {}
      for (const [serial, entry] of this.summaries) {
        if (entry.value) summaries[serial] = entry.value
      }

      this.state = {
        devices: mergeDevices(
          scan,
          { adb: adbDevices, fastboot: this.fastbootDevices, summaries },
          rules
        ),
        scannedAt,
        error: this.usbError,
        usbDevices: this.usbRecords.length,
        adb: { installed: adbInstalled, ok: adbOk, error: adbError }
      }
    } catch (error) {
      this.state = {
        devices: [],
        scannedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown USB scan error',
        usbDevices: 0,
        adb: { installed: adbInstalled, ok: adbOk, error: adbError }
      }
    } finally {
      if (forceUsb) this.forceUsb = false
      this.broadcast()
      this.schedule()
    }

    return this.state
  }

  private async refreshSummaries(adbDevices: AdbDevice[]): Promise<void> {
    if (!this.adb) return
    const active = new Set(
      adbDevices.filter((device) => device.state === 'device').map((device) => device.serial)
    )
    for (const serial of [...this.summaries.keys()]) {
      if (!active.has(serial)) this.summaries.delete(serial)
    }

    for (const device of adbDevices) {
      if (device.state !== 'device') continue
      const cached = this.summaries.get(device.serial)
      const ttl = cached?.value ? SUMMARY_TTL_MS : SUMMARY_RETRY_MS
      if (cached && Date.now() - cached.at < ttl) continue
      const value = await this.adb.getSummary(device.serial)
      this.summaries.set(device.serial, { at: Date.now(), value })
    }
  }

  private schedule(): void {
    if (!this.started) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.scanNow(false), POLL_INTERVAL_MS)
  }

  private broadcast(): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed()) continue
      try {
        window.webContents.send(IPC.deviceUpdate, this.state)
      } catch {
        // A closing window must never stop the watcher loop.
      }
    }
  }
}
