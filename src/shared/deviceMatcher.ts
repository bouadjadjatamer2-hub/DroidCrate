import type { AdbDevice, DeviceSummary } from './adb'
import type {
  DetectedDevice,
  DeviceConnectionState,
  DeviceMode,
  DeviceRule,
  DeviceRules,
  MatchConfidence,
  SupportedMode,
  ToolSuggestion,
  UsbDeviceRecord,
  UsbScan
} from './device'

interface DeviceGroup {
  vid: string
  pid: string
  records: UsbDeviceRecord[]
}

/** Everything the watcher learned from adb/fastboot in one polling pass. */
export interface DeviceProbe {
  adb: AdbDevice[]
  fastboot: AdbDevice[]
  summaries: Record<string, DeviceSummary>
}

const MODE_KEYWORDS: Array<{ mode: SupportedMode; patterns: RegExp[] }> = [
  {
    mode: 'edl',
    patterns: [/qdl/i, /9008/i, /qualcomm hs-usb/i, /emergency download/i, /\bedl\b/i]
  },
  {
    mode: 'brom',
    patterns: [/preloader/i, /mediatek usb port/i, /mtk usb/i, /\bbrom\b/i]
  },
  {
    mode: 'fastboot',
    patterns: [/fastboot/i, /bootloader interface/i]
  },
  {
    mode: 'download',
    patterns: [/download mode/i, /\bodin\b/i, /lge androidnet/i, /samsung mobile usb modem/i]
  },
  {
    mode: 'adb',
    patterns: [/\badb\b/i, /android debug bridge/i]
  }
]

const GENERIC_NAMES = new Set([
  'usb composite device',
  'usb device',
  'android',
  'android device',
  'adb interface',
  'android adb interface',
  'android bootloader interface',
  'mtp',
  'ptp',
  'rndis',
  'remote ndis based internet sharing device',
  'samsung mobile usb composite device',
  'samsung mobile cdc composite device',
  'samsung mobile usb modem',
  'winusb device',
  'usb serial device',
  'lge androidnet usb serial port',
  'qualcomm hs-usb qdloader 9008',
  'mediatek usb port',
  'preloader'
])

const BAD_MODEL_HINTS =
  /usb composite|composite device|adb interface|bootloader|rndis|remote ndis|\bmtp\b|\bptp\b|winusb|modem|serial port|usb device|input device|keyboard|mouse|gamepad|hub|bluetooth|audio|card reader|^android$/i

/** Windows instance IDs end with the device serial: USB\VID_x&PID_y\SERIAL. */
const INSTANCE_SERIAL = /^USB\\[^\\]+\\([^\\]+)$/i

function normalizeHex(value: string): string {
  return value.trim().toUpperCase()
}

function cleanText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function groupDevices(records: UsbDeviceRecord[]): DeviceGroup[] {
  const groups = new Map<string, DeviceGroup>()

  for (const record of records) {
    const vid = normalizeHex(record.vid)
    const pid = normalizeHex(record.pid)
    if (!/^[0-9A-F]{4}$/.test(vid) || !/^[0-9A-F]{4}$/.test(pid)) continue

    const key = `${vid}:${pid}`
    const existing = groups.get(key)
    if (existing) {
      existing.records.push(record)
    } else {
      groups.set(key, { vid, pid, records: [record] })
    }
  }

  return [...groups.values()]
}

function textOf(group: DeviceGroup): string {
  return group.records
    .map((record) => `${record.friendlyName} ${record.busReported}`)
    .join(' ')
    .toLowerCase()
}

function findRule(group: DeviceGroup, rules: DeviceRules): DeviceRule | null {
  const text = textOf(group)
  return (
    rules.rules.find((rule) => {
      if (normalizeHex(rule.vid) !== group.vid) return false
      if (!rule.pids.map(normalizeHex).includes(group.pid)) return false
      if (rule.nameIncludes && rule.nameIncludes.length > 0) {
        return rule.nameIncludes.some((needle) => text.includes(needle.toLowerCase()))
      }
      return true
    }) ?? null
  )
}

function inferMode(group: DeviceGroup): SupportedMode | null {
  const text = textOf(group)
  for (const entry of MODE_KEYWORDS) {
    if (entry.patterns.some((pattern) => pattern.test(text))) return entry.mode
  }
  return null
}

function isCandidate(group: DeviceGroup, rules: DeviceRules): boolean {
  if (findRule(group, rules)) return true

  const text = textOf(group)
  if (group.vid === '0E8D' || group.vid === '05C6') {
    return /mediatek usb port|preloader|mtk usb|qdl|9008|android|edl/.test(text)
  }

  if (/android|adb|fastboot|mtp|ptp|download mode|odin|qdl|preloader|bootloader/.test(text)) {
    return true
  }

  // A known phone vendor can expose a plain USB device (often the model name)
  // before adb is authorised. Show it instead of pretending nothing is plugged
  // in, but require a model-like name so hubs, audio and HID hardware stay out.
  if (rules.vendors[group.vid]) {
    const model = extractModel(group)
    return model !== null && looksLikeModelName(model)
  }

  return false
}

function extractModel(group: DeviceGroup): string | null {
  const base = group.records.find((record) => !record.instanceId.includes('&MI_'))
  const candidates = [
    base?.busReported,
    base?.friendlyName,
    ...group.records.map((record) => record.busReported),
    ...group.records.map((record) => record.friendlyName)
  ]

  for (const raw of candidates) {
    const value = cleanText(raw)
    if (!value || value.length < 2 || value.length > 64) continue
    if (GENERIC_NAMES.has(value.toLowerCase())) continue
    if (BAD_MODEL_HINTS.test(value)) continue
    if (/^(vid|pid)[_:]/i.test(value)) continue
    if (/^usb\\/i.test(value)) continue
    return value
  }

  return null
}

/** A model-like name has letters and digits, e.g. RMX3263, SM-G991B, Pixel 7. */
function looksLikeModelName(value: string): boolean {
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return false
  if (BAD_MODEL_HINTS.test(value)) return false
  if (GENERIC_NAMES.has(value.toLowerCase())) return false
  return value.length >= 3 && value.length <= 48
}

function extractSerial(group: DeviceGroup): string | null {
  for (const record of group.records) {
    const match = INSTANCE_SERIAL.exec(record.instanceId)
    if (!match) continue
    const value = match[1].trim()
    if (value.length < 3 || value.length > 64) continue
    if (value.includes('&')) continue
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) continue
    return value
  }
  return null
}

function resolveTool(
  vid: string,
  mode: SupportedMode,
  rule: DeviceRule | null,
  rules: DeviceRules
): ToolSuggestion | null {
  if (rule?.tool) return rule.tool

  const brandTool = rules.brandTools?.[vid]?.[mode]
  if (brandTool) return brandTool

  return rules.modeTools[mode] ?? null
}

function confidenceFor(rule: DeviceRule | null, mode: DeviceMode): MatchConfidence {
  if (rule) return 'high'
  if (mode !== 'unknown') return 'medium'
  return 'low'
}

function matchGroup(group: DeviceGroup, rules: DeviceRules, seenAt: string): DetectedDevice {
  const rule = findRule(group, rules)
  const inferred = inferMode(group)
  const mode: DeviceMode = rule?.mode ?? inferred ?? 'unknown'
  const vendor = rules.vendors[group.vid]
  const brand = rule?.brand ?? vendor?.brand ?? ''
  const model = extractModel(group)
  const names = [
    ...new Set(
      group.records
        .flatMap((record) => [cleanText(record.busReported), cleanText(record.friendlyName)])
        .filter(Boolean)
    )
  ].slice(0, 6)

  return {
    id: `${group.vid}:${group.pid}`,
    vid: group.vid,
    pid: group.pid,
    usbId: `${group.vid}:${group.pid}`,
    brand,
    model,
    mode,
    confidence: confidenceFor(rule, mode),
    ruleId: rule?.id ?? null,
    note: rule?.note ?? null,
    tool: mode === 'unknown' ? null : resolveTool(group.vid, mode, rule, rules),
    driver: vendor?.driver ?? null,
    names,
    serial: extractSerial(group),
    state: null,
    summary: null,
    source: 'usb',
    lastSeenAt: seenAt
  }
}

export function detectDevices(scan: UsbScan, rules: DeviceRules): DetectedDevice[] {
  return groupDevices(scan.devices)
    .filter((group) => isCandidate(group, rules))
    .map((group) => matchGroup(group, rules, scan.scannedAt))
    .sort((left, right) => {
      const leftUnknown = left.mode === 'unknown' ? 1 : 0
      const rightUnknown = right.mode === 'unknown' ? 1 : 0
      if (leftUnknown !== rightUnknown) return leftUnknown - rightUnknown
      return `${left.brand} ${left.model ?? ''}`.localeCompare(`${right.brand} ${right.model ?? ''}`)
    })
}

export function toConnectionState(value: string): DeviceConnectionState {
  switch (value) {
    case 'device':
    case 'unauthorized':
    case 'offline':
    case 'recovery':
    case 'sideload':
    case 'bootloader':
    case 'fastbootd':
      return value
    case 'fastboot':
      return 'bootloader'
    default:
      return 'unknown'
  }
}

function findUsbMatch(
  usbDevices: DetectedDevice[],
  consumed: Set<number>,
  entry: AdbDevice
): number {
  const candidates = [entry.model, entry.product, entry.device]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase())
  return usbDevices.findIndex((device, index) => {
    if (consumed.has(index)) return false
    if (
      device.serial &&
      entry.serial &&
      device.serial.toLowerCase() === entry.serial.toLowerCase()
    ) {
      return true
    }
    if (device.model && candidates.includes(device.model.toLowerCase())) return true
    if (
      device.names.some((name) => candidates.includes(name.toLowerCase()))
    ) {
      return true
    }
    return false
  })
}

/**
 * Merges the Windows USB inventory with the authoritative adb/fastboot list.
 * The tools win: they know the serial, the real state and (for authorised
 * devices) the actual model, Android version and chipset.
 */
export function mergeDevices(
  scan: UsbScan,
  probe: DeviceProbe,
  rules: DeviceRules
): DetectedDevice[] {
  const seenAt = scan.scannedAt
  const usbDevices = detectDevices(scan, rules)
  const consumed = new Set<number>()
  const merged: DetectedDevice[] = []

  const attach = (
    entry: AdbDevice,
    mode: 'adb' | 'fastboot',
    summary: DeviceSummary | null
  ): void => {
    if (merged.some((device) => device.serial === entry.serial)) return
    const index = findUsbMatch(usbDevices, consumed, entry)
    const base = index >= 0 ? usbDevices[index] : null
    if (index >= 0) consumed.add(index)

    const vendor = base ? rules.vendors[base.vid] : undefined
    const state: DeviceConnectionState =
      mode === 'fastboot'
        ? entry.state === 'fastbootd'
          ? 'fastbootd'
          : 'bootloader'
        : toConnectionState(entry.state)

    merged.push({
      id: entry.serial,
      vid: base?.vid ?? '',
      pid: base?.pid ?? '',
      usbId: base?.usbId ?? '',
      brand: summary?.manufacturer ?? base?.brand ?? vendor?.brand ?? '',
      model: summary?.model ?? entry.model ?? base?.model ?? null,
      mode,
      confidence: 'high',
      ruleId: base?.ruleId ?? null,
      note: base?.note ?? null,
      tool: base?.tool ?? resolveTool(base?.vid ?? '', mode, null, rules),
      driver: base?.driver ?? vendor?.driver ?? null,
      names: base?.names ?? [],
      serial: entry.serial,
      state,
      summary,
      source: base ? 'usb+adb' : mode === 'fastboot' ? 'fastboot' : 'adb',
      lastSeenAt: seenAt
    })
  }

  for (const entry of probe.adb) {
    attach(entry, 'adb', probe.summaries[entry.serial] ?? null)
  }
  for (const entry of probe.fastboot) {
    attach(entry, 'fastboot', null)
  }
  for (let index = 0; index < usbDevices.length; index += 1) {
    if (!consumed.has(index)) merged.push(usbDevices[index])
  }

  const rank = (device: DetectedDevice): number => {
    if (device.state === 'device') return 0
    if (device.state === 'unauthorized') return 1
    if (device.state === 'offline') return 2
    if (device.mode === 'fastboot') return 3
    if (device.mode === 'unknown') return 5
    return 4
  }

  return merged.sort((left, right) => {
    const byState = rank(left) - rank(right)
    if (byState !== 0) return byState
    return `${left.brand} ${left.model ?? ''}`.localeCompare(`${right.brand} ${right.model ?? ''}`)
  })
}

export function isSupportedMode(mode: DeviceMode): mode is SupportedMode {
  return mode !== 'unknown'
}
