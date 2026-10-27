import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import type { DeviceRules } from '@shared/device'
import { dataDirectory } from '../paths'

const toolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  linkKind: z.enum(['download', 'support']),
  note: z.string().optional()
})

const driverSchema = z.object({
  name: z.string().min(1),
  url: z.string().url()
})

const vendorSchema = z.object({
  brand: z.string().min(1),
  driver: driverSchema.optional()
})

const modeToolSetSchema = z.object({
  adb: toolSchema.optional(),
  fastboot: toolSchema.optional(),
  download: toolSchema.optional(),
  edl: toolSchema.optional(),
  brom: toolSchema.optional()
})

const ruleSchema = z.object({
  id: z.string().min(1),
  vid: z.string().regex(/^[0-9A-Fa-f]{4}$/),
  pids: z.array(z.string().regex(/^[0-9A-Fa-f]{4}$/)).min(1),
  mode: z.enum(['adb', 'fastboot', 'download', 'edl', 'brom']),
  brand: z.string().optional(),
  nameIncludes: z.array(z.string()).optional(),
  note: z.string().optional(),
  tool: toolSchema.optional()
})

const rulesSchema = z.object({
  schemaVersion: z.number().int().positive(),
  updated: z.string().min(1),
  vendors: z.record(z.string(), vendorSchema),
  modeTools: modeToolSetSchema,
  brandTools: z.record(z.string(), modeToolSetSchema).optional(),
  rules: z.array(ruleSchema)
})

interface CachedRules {
  mtimeMs: number
  rules: DeviceRules
}

let cache: CachedRules | null = null

export async function loadDeviceRules(): Promise<DeviceRules> {
  const file = join(dataDirectory(), 'devices.json')
  const info = await stat(file)
  if (cache && cache.mtimeMs === info.mtimeMs) return cache.rules

  const raw = await readFile(file, 'utf8')
  const parsed = rulesSchema.parse(JSON.parse(raw)) as DeviceRules
  cache = { mtimeMs: info.mtimeMs, rules: parsed }
  return parsed
}
