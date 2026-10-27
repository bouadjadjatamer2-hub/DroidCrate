export type DeviceMode = 'adb' | 'fastboot' | 'download' | 'edl' | 'brom' | 'unknown'
export type SupportedMode = Exclude<DeviceMode, 'unknown'>
export type MatchConfidence = 'high' | 'medium' | 'low'

export interface UsbDeviceRecord {
  vid: string
  pid: string
  instanceId: string
  friendlyName: string
  className: string
  status: string
  busReported: string
}

export interface UsbScan {
  devices: UsbDeviceRecord[]
  scannedAt: string
}

export interface ToolSuggestion {
  id: string
  name: string
  url: string
  linkKind: 'download' | 'support'
  note?: string
}

export interface DriverSuggestion {
  name: string
  url: string
}

export interface DeviceVendor {
  brand: string
  driver?: DriverSuggestion
}

export interface DeviceRule {
  id: string
  vid: string
  pids: string[]
  mode: SupportedMode
  brand?: string
  nameIncludes?: string[]
  note?: string
  tool?: ToolSuggestion
}

export interface DeviceRules {
  schemaVersion: number
  updated: string
  vendors: Record<string, DeviceVendor>
  modeTools: Partial<Record<SupportedMode, ToolSuggestion>>
  brandTools?: Record<string, Partial<Record<SupportedMode, ToolSuggestion>>>
  rules: DeviceRule[]
}

export interface DetectedDevice {
  id: string
  vid: string
  pid: string
  usbId: string
  brand: string
  model: string | null
  mode: DeviceMode
  confidence: MatchConfidence
  ruleId: string | null
  note: string | null
  tool: ToolSuggestion | null
  driver: DriverSuggestion | null
  names: string[]
}

export interface DeviceState {
  devices: DetectedDevice[]
  scannedAt: string
  error: string | null
  usbDevices: number
}
