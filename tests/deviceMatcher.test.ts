import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type {
  DeviceRules,
  UsbDeviceRecord,
  UsbScan,
} from '@shared/device'
import type { AdbDevice, DeviceSummary } from '@shared/adb'
import { detectDevices, mergeDevices } from '@shared/deviceMatcher'

const rules = JSON.parse(
  readFileSync(resolve(process.cwd(), 'data/devices.json'), 'utf8')
) as DeviceRules

function record(overrides: Partial<UsbDeviceRecord>): UsbDeviceRecord {
  return {
    vid: '22D9',
    pid: '2766',
    instanceId: 'USB\\VID_22D9&PID_2766\\TEST',
    friendlyName: 'USB Composite Device',
    className: 'USB',
    status: 'OK',
    busReported: 'RMX3263',
    ...overrides
  }
}

function scan(devices: UsbDeviceRecord[]): UsbScan {
  return { devices, scannedAt: '2026-10-26T00:00:00.000Z' }
}

describe('detectDevices', () => {
  it('detects a connected OPPO/Realme phone and groups its interfaces', () => {
    const devices = detectDevices(
      scan([
        record({}),
        record({
          instanceId: 'USB\\VID_22D9&PID_2766&MI_02\\TEST',
          friendlyName: 'ADB Interface',
          busReported: 'ADB Interface'
        })
      ]),
      rules
    )

    expect(devices).toHaveLength(1)
    expect(devices[0]).toMatchObject({
      usbId: '22D9:2766',
      brand: 'OPPO / Realme',
      model: 'RMX3263',
      mode: 'adb',
      confidence: 'high',
      ruleId: 'oppo-adb'
    })
    expect(devices[0].tool?.id).toBe('platform-tools')
  })

  it('reads Qualcomm EDL from the known vendor and product identifiers', () => {
    const devices = detectDevices(
      scan([
        record({
          vid: '05C6',
          pid: '9008',
          instanceId: 'USB\\VID_05C6&PID_9008\\TEST',
          friendlyName: 'Qualcomm HS-USB QDLoader 9008',
          className: 'Ports',
          busReported: 'Qualcomm HS-USB QDLoader 9008'
        })
      ]),
      rules
    )

    expect(devices).toHaveLength(1)
    expect(devices[0]).toMatchObject({
      mode: 'edl',
      confidence: 'high',
      ruleId: 'qualcomm-edl'
    })
    expect(devices[0].tool?.linkKind).toBe('support')
  })

  it('ignores unrelated USB hardware such as a webcam', () => {
    const devices = detectDevices(
      scan([
        record({
          vid: '13D3',
          pid: '5406',
          instanceId: 'USB\\VID_13D3&PID_5406&MI_00\\TEST',
          friendlyName: 'Integrated Camera',
          className: 'Camera',
          busReported: 'Integrated Camera'
        })
      ]),
      rules
    )

    expect(devices).toEqual([])
  })

  it('infers ADB for an unknown vendor without claiming a device rule', () => {
    const devices = detectDevices(
      scan([
        record({
          vid: '1D6B',
          pid: '0104',
          instanceId: 'USB\\VID_1D6B&PID_0104\\TEST',
          friendlyName: 'Android ADB Interface',
          busReported: 'Android'
        })
      ]),
      rules
    )

    expect(devices).toHaveLength(1)
    expect(devices[0]).toMatchObject({
      mode: 'adb',
      confidence: 'medium',
      ruleId: null,
      brand: ''
    })
  })

  it('shows a known-vendor phone whose product id has no rule yet', () => {
    const devices = detectDevices(
      scan([
        record({
          pid: '2769',
          instanceId: 'USB\\VID_22D9&PID_2769\\2118294910DA24YT',
          friendlyName: 'RMX3263',
          busReported: 'RMX3263'
        })
      ]),
      rules
    )

    expect(devices).toHaveLength(1)
    expect(devices[0]).toMatchObject({
      usbId: '22D9:2769',
      brand: 'OPPO / Realme',
      model: 'RMX3263',
      serial: '2118294910DA24YT',
      mode: 'unknown',
      source: 'usb',
      state: null
    })
  })
})

describe('mergeDevices', () => {
  const summary: DeviceSummary = {
    manufacturer: 'realme',
    model: 'RMX3263',
    androidVersion: '11',
    sdk: '30',
    build: 'RP1A.200720.011',
    securityPatch: '2022-05-05',
    abi: 'arm64-v8a',
    soc: 'ums512',
    bootloaderUnlocked: false
  }

  const usbPhone = scan([
    record({
      pid: '2769',
      instanceId: 'USB\\VID_22D9&PID_2769\\2118294910DA24YT',
      friendlyName: 'RMX3263',
      busReported: 'RMX3263'
    })
  ])

  function adbDevice(overrides: Partial<AdbDevice>): AdbDevice {
    return {
      serial: '2118294910DA24YT',
      state: 'device',
      model: 'RMX3263',
      product: 'RMX3263',
      device: 'RED8D1',
      transportId: '1',
      ...overrides
    }
  }

  it('merges USB and ADB into one device with real specifications', () => {
    const merged = mergeDevices(
      usbPhone,
      { adb: [adbDevice({})], fastboot: [], summaries: { '2118294910DA24YT': summary } },
      rules
    )

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      id: '2118294910DA24YT',
      serial: '2118294910DA24YT',
      usbId: '22D9:2769',
      brand: 'realme',
      model: 'RMX3263',
      mode: 'adb',
      state: 'device',
      source: 'usb+adb',
      summary: { sdk: '30', soc: 'ums512' }
    })
  })

  it('keeps an unauthorised phone visible and explains the state', () => {
    const merged = mergeDevices(
      usbPhone,
      {
        adb: [adbDevice({ state: 'unauthorized', model: null })],
        fastboot: [],
        summaries: {}
      },
      rules
    )

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      serial: '2118294910DA24YT',
      state: 'unauthorized',
      summary: null,
      source: 'usb+adb'
    })
  })

  it('still reports a device that ADB sees but Windows has not enumerated', () => {
    const merged = mergeDevices(
      scan([]),
      { adb: [adbDevice({})], fastboot: [], summaries: {} },
      rules
    )

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      id: '2118294910DA24YT',
      source: 'adb',
      state: 'device',
      mode: 'adb',
      usbId: ''
    })
  })

  it('maps fastboot entries to the bootloader state', () => {
    const merged = mergeDevices(
      usbPhone,
      {
        adb: [],
        fastboot: [adbDevice({ state: 'fastboot' })],
        summaries: {}
      },
      rules
    )

    expect(merged[0]).toMatchObject({
      mode: 'fastboot',
      state: 'bootloader',
      source: 'usb+adb'
    })
  })
})
