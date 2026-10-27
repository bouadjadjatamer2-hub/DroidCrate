import { z } from 'zod'

const itemSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'Item ids must be lowercase kebab-case'),
  title: z.string().min(1),
  detail: z.string().min(1),
  required: z.boolean()
})

const checklistSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'Checklist ids must be lowercase kebab-case'),
  title: z.string().min(1),
  summary: z.string().min(1),
  risk: z.enum(['medium', 'high']),
  warning: z.string().min(1),
  items: z.array(itemSchema).min(3)
})

export const checklistLibrarySchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    updated: z.string().min(1),
    checklists: z.array(checklistSchema).min(1)
  })
  .superRefine((library, context) => {
    const seen = new Set<string>()
    for (const checklist of library.checklists) {
      if (seen.has(checklist.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate checklist id: ${checklist.id}`,
          path: ['checklists']
        })
      }
      seen.add(checklist.id)

      const required = checklist.items.filter((item) => item.required)
      if (required.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Checklist ${checklist.id} needs at least one required item`,
          path: ['checklists']
        })
      }

      const itemIds = new Set(checklist.items.map((item) => item.id))
      if (itemIds.size !== checklist.items.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Checklist ${checklist.id} has duplicate item ids`,
          path: ['checklists']
        })
      }
    }
  })
