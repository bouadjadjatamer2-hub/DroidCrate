import { z } from 'zod'

const linkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  kind: z.enum(['download', 'source', 'guide', 'support'])
})

const toolSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'Tool ids must be lowercase kebab-case'),
  name: z.string().min(1),
  vendor: z.string().min(1),
  category: z.enum(['platform', 'flashing', 'recovery', 'root', 'driver']),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  availability: z.enum(['download', 'support-only']),
  summary: z.string().min(1),
  brands: z.array(z.string().min(1)),
  chipsets: z.array(z.string().min(1)),
  platforms: z.array(z.enum(['windows', 'macos', 'linux', 'android', 'web'])).min(1),
  links: z.array(linkSchema).min(1),
  notes: z.array(z.string().min(1)),
  warning: z.string().min(1).optional()
})

export const toolLibrarySchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    updated: z.string().min(1),
    tools: z.array(toolSchema).min(1)
  })
  .superRefine((library, context) => {
    const seen = new Set<string>()
    for (const tool of library.tools) {
      if (seen.has(tool.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate tool id: ${tool.id}`,
          path: ['tools']
        })
      }
      seen.add(tool.id)

      if (tool.availability === 'support-only' && tool.links.some((link) => link.kind === 'download')) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Support-only tool ${tool.id} must not offer a direct download link`,
          path: ['tools']
        })
      }
    }
  })
