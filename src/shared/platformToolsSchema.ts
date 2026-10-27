import { z } from 'zod'

const httpsUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'), 'Only HTTPS sources are allowed')

export const platformToolsCatalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    checkedAt: z.string().min(10),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must look like 37.0.1'),
    released: z.string().min(3),
    fileName: z.string().regex(/^[A-Za-z0-9._-]+$/, 'Unsafe file name'),
    url: z
      .string()
      .url()
      .refine(
        (value) => value.startsWith('https://dl.google.com/android/repository/'),
        'Platform Tools must come from the official Google repository'
      ),
    sha256: z.string().regex(/^[a-f0-9]{64}$/, 'SHA-256 must be 64 lowercase hex characters'),
    sha1: z.string().regex(/^[a-f0-9]{40}$/, 'SHA-1 must be 40 lowercase hex characters').optional(),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(200 * 1024 * 1024, 'Unexpected archive size'),
    source: z
      .object({
        releasePage: httpsUrl,
        catalog: httpsUrl,
        collectedAt: z.string().min(10),
        note: z.string().min(10)
      })
      .strict()
  })
  .strict()

export type PlatformToolsCatalogInput = z.input<typeof platformToolsCatalogSchema>
