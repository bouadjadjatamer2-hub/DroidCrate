import { readFile, stat } from 'node:fs/promises'
import { parseDeviceRules } from '@shared/deviceSchema'
import type { DeviceRules } from '@shared/device'
import { contentRevision, resolveContentPath } from '../paths'

interface CachedRules {
  revision: number
  mtimeMs: number
  rules: DeviceRules
}

let cache: CachedRules | null = null

export async function loadDeviceRules(): Promise<DeviceRules> {
  const file = resolveContentPath('devices.json')
  const info = await stat(file)
  const revision = contentRevision()
  if (cache && cache.revision === revision && cache.mtimeMs === info.mtimeMs) return cache.rules

  const raw = await readFile(file, 'utf8')
  const parsed = parseDeviceRules(JSON.parse(raw))
  cache = { revision, mtimeMs: info.mtimeMs, rules: parsed }
  return parsed
}
