import type {
  DetectedDevice,
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
  /usb composite|composite device|adb interface|bootloader|rndis|remote ndis|\bmtp\b|\bptp\b|winusb|modem|serial port|usb device|^android$/i

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

  return /android|adb|fastboot|mtp|ptp|download mode|odin|qdl|preloader|bootloader/.test(text)
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

function matchGroup(group: DeviceGroup, rules: DeviceRules): DetectedDevice {
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
    names
  }
}

export function detectDevices(scan: UsbScan, rules: DeviceRules): DetectedDevice[] {
  return groupDevices(scan.devices)
    .filter((group) => isCandidate(group, rules))
    .map((group) => matchGroup(group, rules))
    .sort((left, right) => {
      const leftUnknown = left.mode === 'unknown' ? 1 : 0
      const rightUnknown = right.mode === 'unknown' ? 1 : 0
      if (leftUnknown !== rightUnknown) return leftUnknown - rightUnknown
      return `${left.brand} ${left.model ?? ''}`.localeCompare(`${right.brand} ${right.model ?? ''}`)
    })
}

export function isSupportedMode(mode: DeviceMode): mode is SupportedMode {
  return mode !== 'unknown'
}
