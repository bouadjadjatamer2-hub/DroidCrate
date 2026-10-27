import { z } from 'zod'

/** Only files inside the published data directory can be updated. */
const contentPathSchema = z
  .string()
  .min(5)
  .max(120)
  .regex(/^(?:[a-z0-9][a-z0-9-]*\/)?[a-z0-9][a-z0-9-]*\.(?:json|md)$/)

const contentFileSchema = z.object({
  path: contentPathSchema,
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().min(1).max(1024 * 1024)
})

export const contentManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    contentVersion: z.string().regex(/^\d{4}\.\d{2}\.\d{2}(?:-[a-z0-9]+)?$/),
    generatedAt: z.string().datetime(),
    files: z.array(contentFileSchema).min(4).max(200)
  })
  .superRefine((manifest, context) => {
    const paths = new Set<string>()
    for (const file of manifest.files) {
      if (paths.has(file.path)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate content file: ${file.path}`
        })
      }
      paths.add(file.path)
    }

    for (const required of ['tools.json', 'checklists.json', 'lessons.json', 'devices.json']) {
      if (!paths.has(required)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Content manifest is missing ${required}.`
        })
      }
    }

    if (paths.has('content-manifest.json')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The manifest cannot list itself.'
      })
    }
  })

export type ContentManifest = z.infer<typeof contentManifestSchema>
export type ContentManifestFile = z.infer<typeof contentFileSchema>

export function parseContentManifest(raw: unknown): ContentManifest {
  return contentManifestSchema.parse(raw) as ContentManifest
}

export type ContentSource = 'bundled' | 'user'
export type ContentUpdateError = 'network' | 'invalid' | 'hash' | 'version' | 'io'

export interface ContentStatus {
  source: ContentSource
  contentVersion: string
  generatedAt: string
  fileCount: number
  totalBytes: number
  /** Fixed official manifest; the renderer never supplies a download URL. */
  remoteUrl: string
  /** Version shipped inside the installed application. */
  bundledVersion: string
}

export interface ContentChange {
  path: string
  bytes: number
  reason: 'added' | 'changed' | 'removed'
}

export interface ContentCheckResult {
  available: boolean
  checkedAt: string
  installedVersion: string
  remoteVersion: string | null
  changes: ContentChange[]
  totalBytes: number
  error: ContentUpdateError | null
  message: string | null
}

export interface ContentApplyResult {
  installed: boolean
  version: string | null
  fileCount: number
  totalBytes: number
  error: ContentUpdateError | null
  message: string | null
}

export const CONTENT_MANIFEST_FILE = 'content-manifest.json'

/** Official source of truth. Downloads always use this repository. */
export const CONTENT_MANIFEST_URL =
  'https://raw.githubusercontent.com/bouadjadjatamer2-hub/DroidCrate/main/data/content-manifest.json'

export const CONTENT_REMOTE_BASE =
  'https://raw.githubusercontent.com/bouadjadjatamer2-hub/DroidCrate/main/data'

/**
 * Compares two manifests by path and hash. The remote generation time is not
 * used for the decision, so rebuilding the manifest without edits is harmless.
 */
export function diffContent(
  current: ContentManifest,
  next: ContentManifest
): ContentChange[] {
  const installed = new Map(current.files.map((file) => [file.path, file]))
  const nextPaths = new Map(next.files.map((file) => [file.path, file]))
  const changes: ContentChange[] = []

  for (const file of next.files) {
    const existing = installed.get(file.path)
    if (!existing) {
      changes.push({ path: file.path, bytes: file.bytes, reason: 'added' })
    } else if (existing.sha256 !== file.sha256) {
      changes.push({ path: file.path, bytes: file.bytes, reason: 'changed' })
    }
  }

  for (const file of current.files) {
    if (!nextPaths.has(file.path)) {
      changes.push({ path: file.path, bytes: file.bytes, reason: 'removed' })
    }
  }

  return changes.sort((left, right) => left.path.localeCompare(right.path))
}
