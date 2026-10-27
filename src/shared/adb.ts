export type AdbToolName = 'adb' | 'fastboot'

export type AdbActionId =
  | 'adb-version'
  | 'adb-devices'
  | 'adb-device-info'
  | 'adb-battery'
  | 'adb-storage'
  | 'adb-reboot-system'
  | 'adb-reboot-bootloader'
  | 'adb-reboot-recovery'
  | 'fastboot-devices'
  | 'fastboot-info'

export type AdbErrorCode =
  | 'not-installed'
  | 'invalid-action'
  | 'invalid-serial'
  | 'confirmation-required'
  | 'timeout'
  | 'spawn-failed'
  | 'failed'

export interface AdbActionDefinition {
  id: AdbActionId
  tool: AdbToolName
  group: 'read' | 'restart' | 'fastboot'
  requiresSerial: boolean
  requiresConfirmation: boolean
  args: string[]
}

/**
 * The renderer cannot send arbitrary commands. Every action is resolved from
 * this fixed table inside the main process.
 */
export const ADB_ACTIONS: Record<AdbActionId, AdbActionDefinition> = {
  'adb-version': {
    id: 'adb-version',
    tool: 'adb',
    group: 'read',
    requiresSerial: false,
    requiresConfirmation: false,
    args: ['version']
  },
  'adb-devices': {
    id: 'adb-devices',
    tool: 'adb',
    group: 'read',
    requiresSerial: false,
    requiresConfirmation: false,
    args: ['devices', '-l']
  },
  'adb-device-info': {
    id: 'adb-device-info',
    tool: 'adb',
    group: 'read',
    requiresSerial: true,
    requiresConfirmation: false,
    args: ['shell', 'getprop']
  },
  'adb-battery': {
    id: 'adb-battery',
    tool: 'adb',
    group: 'read',
    requiresSerial: true,
    requiresConfirmation: false,
    args: ['shell', 'dumpsys', 'battery']
  },
  'adb-storage': {
    id: 'adb-storage',
    tool: 'adb',
    group: 'read',
    requiresSerial: true,
    requiresConfirmation: false,
    args: ['shell', 'df', '-h', '/data']
  },
  'adb-reboot-system': {
    id: 'adb-reboot-system',
    tool: 'adb',
    group: 'restart',
    requiresSerial: true,
    requiresConfirmation: true,
    args: ['reboot']
  },
  'adb-reboot-bootloader': {
    id: 'adb-reboot-bootloader',
    tool: 'adb',
    group: 'restart',
    requiresSerial: true,
    requiresConfirmation: true,
    args: ['reboot', 'bootloader']
  },
  'adb-reboot-recovery': {
    id: 'adb-reboot-recovery',
    tool: 'adb',
    group: 'restart',
    requiresSerial: true,
    requiresConfirmation: true,
    args: ['reboot', 'recovery']
  },
  'fastboot-devices': {
    id: 'fastboot-devices',
    tool: 'fastboot',
    group: 'fastboot',
    requiresSerial: false,
    requiresConfirmation: false,
    args: ['devices']
  },
  'fastboot-info': {
    id: 'fastboot-info',
    tool: 'fastboot',
    group: 'fastboot',
    requiresSerial: true,
    requiresConfirmation: false,
    args: []
  }
}

export interface AdbDevice {
  serial: string
  state: string
  model: string | null
  product: string | null
  device: string | null
  transportId: string | null
}

export interface AdbActionResult {
  ok: boolean
  action: AdbActionId
  tool: AdbToolName
  command: string
  output: string
  error: string | null
  errorCode: AdbErrorCode | null
  exitCode: number | null
  durationMs: number
  startedAt: string
}

export interface AdbLogEntry extends AdbActionResult {
  id: string
}

export interface AdbDevicesResult {
  ok: boolean
  devices: AdbDevice[]
  output: string
  error: string | null
  errorCode: AdbErrorCode | null
}

const SERIAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/

export function isSafeSerial(value: string): boolean {
  return SERIAL_PATTERN.test(value)
}

/**
 * `adb devices -l` lines look like:
 *   R58M12345\tdevice product:... model:... device:... transport_id:1
 * Unauthorized and offline entries are kept so the UI can explain them.
 */
export function parseAdbDevices(output: string): AdbDevice[] {
  const devices: AdbDevice[] = []
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('List of devices attached') || line.startsWith('*')) continue
    if (/^(daemon|adb|error|cannot)\b/i.test(line)) continue
    const match = /^(\S+)\s+(\S+)(.*)$/.exec(line)
    if (!match) continue
    const [, serial, state, rest] = match
    if (state === 'daemon' || state === 'starting') continue
    if (!isSafeSerial(serial)) continue

    const field = (name: string): string | null => {
      const found = new RegExp(`(?:^|\\s)${name}:(\\S+)`).exec(rest)
      return found ? found[1] : null
    }

    devices.push({
      serial,
      state,
      model: field('model'),
      product: field('product'),
      device: field('device'),
      transportId: field('transport_id')
    })
  }
  return devices
}

/**
 * Reads the output of `adb version`, for example:
 *   Android Debug Bridge version 1.0.41
 *   Version 37.0.1-14910842
 */
export function parseAdbVersion(output: string): string | null {
  const build = /^\s*Version\s+(\d+\.\d+\.\d+)(?:-\d+)?/im.exec(output)
  if (build) return build[1]
  const legacy = /Android Debug Bridge version\s+(\d+\.\d+\.\d+)/i.exec(output)
  return legacy ? legacy[1] : null
}

/** Parses the `[key]: [value]` format used by `adb shell getprop`. */
export function parseGetProp(output: string): Record<string, string> {
  const props: Record<string, string> = {}
  for (const rawLine of output.split(/\r?\n/)) {
    const match = /^\[([^\]]+)\]:\s*\[(.*)\]$/.exec(rawLine.trim())
    if (match) props[match[1]] = match[2]
  }
  return props
}

export interface DeviceSummary {
  manufacturer: string | null
  model: string | null
  androidVersion: string | null
  sdk: string | null
  build: string | null
  securityPatch: string | null
  abi: string | null
  soc: string | null
  bootloaderUnlocked: boolean | null
}

export function summariseDevice(props: Record<string, string>): DeviceSummary {
  const flashLocked = props['ro.boot.flash.locked']
  const vbState = props['ro.boot.veritymode'] ?? props['ro.boot.vbmeta.device_state']
  let unlocked: boolean | null = null
  if (flashLocked === '0') unlocked = true
  else if (flashLocked === '1') unlocked = false
  else if (vbState === 'orange') unlocked = true
  else if (vbState === 'green') unlocked = false

  return {
    manufacturer: props['ro.product.manufacturer'] ?? null,
    model: props['ro.product.model'] ?? null,
    androidVersion: props['ro.build.version.release'] ?? null,
    sdk: props['ro.build.version.sdk'] ?? null,
    build: props['ro.build.display.id'] ?? null,
    securityPatch: props['ro.build.version.security_patch'] ?? null,
    abi: props['ro.product.cpu.abi'] ?? null,
    soc: props['ro.soc.model'] ?? props['ro.board.platform'] ?? null,
    bootloaderUnlocked: unlocked
  }
}

/** Fastboot writes `(bootloader) key: value` and `key: value` to either stream. */
export function parseFastbootVars(output: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^\(bootloader\)\s*/, '')
    const match = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(line)
    if (match) vars[match[1]] = match[2]
  }
  return vars
}

export function parseFastbootDevices(output: string): AdbDevice[] {
  const devices: AdbDevice[] = []
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const match = /^(\S+)\s+(fastboot|fastbootd)$/i.exec(line)
    if (!match || !isSafeSerial(match[1])) continue
    devices.push({
      serial: match[1],
      state: match[2].toLowerCase(),
      model: null,
      product: null,
      device: null,
      transportId: null
    })
  }
  return devices
}
