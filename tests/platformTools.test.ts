import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { platformToolsCatalogSchema } from '@shared/platformToolsSchema'
import type { PlatformToolsCatalog } from '@shared/platformTools'
import {
  ADB_ACTIONS,
  isSafeSerial,
  parseAdbDevices,
  parseAdbVersion,
  parseFastbootDevices,
  parseFastbootVars,
  parseGetProp,
  summariseDevice
} from '@shared/adb'

const catalog = platformToolsCatalogSchema.parse(
  JSON.parse(readFileSync(resolve(process.cwd(), 'data/platform-tools.json'), 'utf8'))
) as PlatformToolsCatalog

describe('platform tools catalog', () => {
  it('pins the current official Platform Tools build', () => {
    expect(catalog.version).toBe('37.0.1')
    expect(catalog.url).toBe(
      'https://dl.google.com/android/repository/platform-tools-latest-windows.zip'
    )
    expect(catalog.sizeBytes).toBe(8044989)
    expect(catalog.sha256).toHaveLength(64)
    expect(catalog.sha1).toHaveLength(40)
  })

  it('rejects an unofficial source or a malformed hash', () => {
    expect(
      platformToolsCatalogSchema.safeParse({ ...catalog, url: 'https://example.com/adb.zip' })
        .success
    ).toBe(false)
    expect(
      platformToolsCatalogSchema.safeParse({ ...catalog, sha256: 'not-a-hash' }).success
    ).toBe(false)
  })
})

describe('ADB output parsing', () => {
  it('reads build numbers from modern and legacy version output', () => {
    expect(
      parseAdbVersion(
        'Android Debug Bridge version 1.0.41\nVersion 37.0.1-14910842\nInstalled as C:\\adb.exe'
      )
    ).toBe('37.0.1')
    expect(parseAdbVersion('Android Debug Bridge version 1.0.39')).toBe('1.0.39')
    expect(parseAdbVersion('command not found')).toBeNull()
  })

  it('keeps authorised, unauthorised, and offline devices but skips daemon noise', () => {
    const devices = parseAdbDevices(
      [
        'List of devices attached',
        'daemon not running; starting now at tcp:5037',
        '22D9:2766\tdevice product:RMX3263 model:RMX3263 device:RMX3263 transport_id:1',
        'ABC123\tunauthorized usb:1-2 transport_id:2',
        'OLD999\toffline transport_id:3',
        '--injection\tdevice',
        ''
      ].join('\n')
    )

    expect(devices).toHaveLength(3)
    expect(devices[0]).toMatchObject({
      serial: '22D9:2766',
      state: 'device',
      model: 'RMX3263',
      product: 'RMX3263',
      transportId: '1'
    })
    expect(devices[1].state).toBe('unauthorized')
    expect(devices[2].state).toBe('offline')
  })

  it('reads getprop values and infers the bootloader state', () => {
    const props = parseGetProp(
      [
        '[ro.product.manufacturer]: [realme]',
        '[ro.product.model]: [RMX3263]',
        '[ro.build.version.release]: [12]',
        '[ro.build.version.sdk]: [31]',
        '[ro.build.flash.locked]: [1]',
        '[ro.boot.flash.locked]: [1]',
        '[ro.product.cpu.abi]: [arm64-v8a]',
        '[ro.soc.model]: [SM6225]'
      ].join('\n')
    )

    expect(summariseDevice(props)).toMatchObject({
      manufacturer: 'realme',
      model: 'RMX3263',
      androidVersion: '12',
      sdk: '31',
      abi: 'arm64-v8a',
      soc: 'SM6225',
      bootloaderUnlocked: false
    })
    expect(summariseDevice({ ...props, 'ro.boot.flash.locked': '0' }).bootloaderUnlocked).toBe(true)
  })

  it('parses fastboot devices and getvar output from stderr-style text', () => {
    const devices = parseFastbootDevices('22D9:2766\tfastboot\n\n')
    expect(devices).toEqual([
      {
        serial: '22D9:2766',
        state: 'fastboot',
        model: null,
        product: null,
        device: null,
        transportId: null
      }
    ])

    const vars = parseFastbootVars(
      '(bootloader) product: RMX3263\n(bootloader) unlocked: no\n(bootloader) current-slot: a\n'
    )
    expect(vars).toMatchObject({ product: 'RMX3263', unlocked: 'no', 'current-slot': 'a' })
  })

  it('rejects serial values that could be mistaken for flags', () => {
    expect(isSafeSerial('22D9:2766')).toBe(true)
    expect(isSafeSerial('192.168.1.5:5555')).toBe(true)
    expect(isSafeSerial('-s')).toBe(false)
    expect(isSafeSerial('serial with spaces')).toBe(false)
    expect(isSafeSerial('')).toBe(false)
  })
})

describe('command allow-list', () => {
  it('never exposes flashing, unlock, or wipe arguments', () => {
    const forbidden = ['flash', 'erase', 'unlock', 'format', 'sideload', 'wm', 'pm', 'settings']
    for (const action of Object.values(ADB_ACTIONS)) {
      for (const arg of action.args) {
        expect(forbidden, `${action.id} contains ${arg}`).not.toContain(arg)
      }
    }
  })

  it('requires confirmation for every restart action', () => {
    for (const action of Object.values(ADB_ACTIONS)) {
      if (action.group === 'restart') expect(action.requiresConfirmation).toBe(true)
      else expect(action.requiresConfirmation).toBe(false)
    }
  })
})
