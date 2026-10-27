import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { DeviceRules, UsbDeviceRecord, UsbScan } from '@shared/device'
import { detectDevices } from '@shared/deviceMatcher'

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
})
