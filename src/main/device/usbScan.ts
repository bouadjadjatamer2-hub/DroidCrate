import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { UsbDeviceRecord } from '@shared/device'

const execFileAsync = promisify(execFile)

const SCAN_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$known = 'VID_(18D1|04E8|05C6|0E8D|22D9|2A70|2717|22B8|1004|0FCE|12D1|0BB4|19D2|0B05|1782)'
$usb = @(Get-PnpDevice -PresentOnly | Where-Object {
  $_.InstanceId -like 'USB\\VID_*' -and $_.Status -eq 'OK' -and (
    $_.InstanceId -match $known -or
    $_.FriendlyName -match 'Android|ADB|Fastboot|QDLoader|MediaTek|Preloader|Download Mode|MTP|PTP'
  )
})
$list = foreach ($device in $usb) {
  if ($device.InstanceId -notmatch 'VID_([0-9A-Fa-f]{4})&PID_([0-9A-Fa-f]{4})') { continue }
  $vendorId = $Matches[1].ToUpper()
  $productId = $Matches[2].ToUpper()
  $bus = ''
  $property = $device | Get-PnpDeviceProperty -KeyName 'DEVPKEY_Device_BusReportedDeviceDesc' -ErrorAction SilentlyContinue
  if ($property -and $property.Data) { $bus = [string]$property.Data }
  [PSCustomObject]@{
    vid = $vendorId
    pid = $productId
    instanceId = [string]$device.InstanceId
    friendlyName = [string]$device.FriendlyName
    className = [string]$device.Class
    status = [string]$device.Status
    busReported = $bus
  }
}
@{ devices = @($list) } | ConvertTo-Json -Compress -Depth 4
`

function asRecord(value: unknown): UsbDeviceRecord | null {
  if (typeof value !== 'object' || value === null) return null
  const item = value as Record<string, unknown>
  const fields = ['vid', 'pid', 'instanceId', 'friendlyName', 'className', 'status', 'busReported'] as const
  if (!fields.every((field) => typeof item[field] === 'string')) return null
  return {
    vid: item.vid as string,
    pid: item.pid as string,
    instanceId: item.instanceId as string,
    friendlyName: item.friendlyName as string,
    className: item.className as string,
    status: item.status as string,
    busReported: item.busReported as string
  }
}

export async function scanUsbDevices(): Promise<UsbDeviceRecord[]> {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCAN_SCRIPT],
    {
      windowsHide: true,
      timeout: 12_000,
      maxBuffer: 2 * 1024 * 1024,
      encoding: 'utf8'
    }
  )

  const text = stdout.replace(/^\uFEFF/, '').trim()
  if (!text) return []

  const payload = JSON.parse(text) as { devices?: unknown }
  if (!Array.isArray(payload.devices)) return []
  return payload.devices.map(asRecord).filter((record): record is UsbDeviceRecord => record !== null)
}
