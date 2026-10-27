import { z } from 'zod'
import type { DeviceRules } from './device'

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

export const deviceRulesSchema = z.object({
  schemaVersion: z.number().int().positive(),
  updated: z.string().min(1),
  vendors: z.record(z.string(), vendorSchema),
  modeTools: modeToolSetSchema,
  brandTools: z.record(z.string(), modeToolSetSchema).optional(),
  rules: z.array(ruleSchema)
})

export function parseDeviceRules(raw: unknown): DeviceRules {
  return deviceRulesSchema.parse(raw) as DeviceRules
}
