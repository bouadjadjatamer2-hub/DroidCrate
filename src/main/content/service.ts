import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { checklistLibrarySchema } from '@shared/checklistSchema'
import {
  CONTENT_MANIFEST_FILE,
  CONTENT_MANIFEST_URL,
  CONTENT_REMOTE_BASE,
  diffContent,
  parseContentManifest,
  type ContentApplyResult,
  type ContentCheckResult,
  type ContentManifest,
  type ContentStatus,
  type ContentUpdateError
} from '@shared/contentUpdate'
import { parseDeviceRules } from '@shared/deviceSchema'
import { parseLessonLibrary } from '@shared/lessonSchema'
import { toolLibrarySchema } from '@shared/toolSchema'

const MANIFEST_LIMIT = 256 * 1024
const FILE_LIMIT = 1024 * 1024
const REQUEST_TIMEOUT_MS = 20_000

interface ContentServiceOptions {
  bundledDirectory: string
  userDirectory: string
  fetchImpl?: typeof fetch
  manifestUrl?: string
  remoteBase?: string
}

class ContentError extends Error {
  constructor(
    readonly code: ContentUpdateError,
    message: string
  ) {
    super(message)
    this.name = 'ContentError'
  }
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

function classify(error: unknown): ContentError {
  if (error instanceof ContentError) return error
  if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) {
    return new ContentError('network', 'The official content server could not be reached.')
  }
  if (error instanceof Error && error.name === 'ZodError') {
    return new ContentError('invalid', 'The downloaded content is not valid.')
  }
  return new ContentError('io', error instanceof Error ? error.message : String(error))
}

/**
 * Installs the published lessons, tools, checklists, and device rules from the
 * official DroidCrate repository. Only the fixed official host is used, every
 * file is hash-checked against the manifest, and the whole content directory
 * is swapped atomically. Progress and history live in SQLite outside this
 * directory and are never touched.
 */
export class ContentService {
  private readonly fetchImpl: typeof fetch
  private readonly manifestUrl: string
  private readonly remoteBase: string

  constructor(private readonly options: ContentServiceOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.manifestUrl = options.manifestUrl ?? CONTENT_MANIFEST_URL
    this.remoteBase = options.remoteBase ?? CONTENT_REMOTE_BASE
  }

  async getStatus(): Promise<ContentStatus> {
    const bundled = await this.readBundledManifest()
    const installed = await this.readUserManifest()
    const active = installed ?? bundled
    return {
      source: installed ? 'user' : 'bundled',
      contentVersion: active.contentVersion,
      generatedAt: active.generatedAt,
      fileCount: active.files.length,
      totalBytes: active.files.reduce((total, file) => total + file.bytes, 0),
      remoteUrl: this.manifestUrl,
      bundledVersion: bundled.contentVersion
    }
  }

  async check(): Promise<ContentCheckResult> {
    const checkedAt = new Date().toISOString()
    const current = (await this.readUserManifest()) ?? (await this.readBundledManifest())

    try {
      const remote = await this.fetchManifest()
      const changes = diffContent(current, remote)
      return {
        available: changes.length > 0,
        checkedAt,
        installedVersion: current.contentVersion,
        remoteVersion: remote.contentVersion,
        changes,
        totalBytes: changes.reduce((total, file) => total + file.bytes, 0),
        error: null,
        message: null
      }
    } catch (error) {
      const failure = classify(error)
      return {
        available: false,
        checkedAt,
        installedVersion: current.contentVersion,
        remoteVersion: null,
        changes: [],
        totalBytes: 0,
        error: failure.code,
        message: failure.message
      }
    }
  }

  async apply(expectedVersion: string): Promise<ContentApplyResult> {
    const staging = join(dirname(this.options.userDirectory), `.content-staging-${randomUUID()}`)

    try {
      if (!/^\d{4}\.\d{2}\.\d{2}(?:-[a-z0-9]+)?$/.test(expectedVersion)) {
        throw new ContentError('version', 'The requested content version is not valid.')
      }

      const remote = await this.fetchManifest()
      if (remote.contentVersion !== expectedVersion) {
        throw new ContentError(
          'version',
          'The published content changed since the last check. Check again before installing.'
        )
      }

      const files = new Map<string, Buffer>()
      for (const entry of remote.files) {
        if (files.has(entry.path)) {
          throw new ContentError('invalid', `Duplicate content file: ${entry.path}`)
        }
        const buffer = await this.download(entry.path)
        if (buffer.byteLength !== entry.bytes || sha256(buffer) !== entry.sha256) {
          throw new ContentError('hash', `Content verification failed for ${entry.path}.`)
        }
        files.set(entry.path, buffer)
      }

      this.validateContent(files)

      await mkdir(staging, { recursive: true })
      for (const entry of remote.files) {
        const target = join(staging, entry.path)
        await mkdir(dirname(target), { recursive: true })
        await writeFile(target, files.get(entry.path) as Buffer)
      }
      await writeFile(join(staging, CONTENT_MANIFEST_FILE), `${JSON.stringify(remote, null, 2)}\n`)

      await this.swap(staging)
      return {
        installed: true,
        version: remote.contentVersion,
        fileCount: remote.files.length,
        totalBytes: remote.files.reduce((total, file) => total + file.bytes, 0),
        error: null,
        message: null
      }
    } catch (error) {
      await rm(staging, { recursive: true, force: true }).catch(() => undefined)
      const failure = classify(error)
      return {
        installed: false,
        version: null,
        fileCount: 0,
        totalBytes: 0,
        error: failure.code,
        message: failure.message
      }
    }
  }

  /** Removes installed content and returns to the files shipped with the app. */
  async reset(): Promise<ContentStatus> {
    await rm(this.options.userDirectory, { recursive: true, force: true })
    return this.getStatus()
  }

  private async swap(staging: string): Promise<void> {
    const target = this.options.userDirectory
    const backup = join(dirname(target), `.content-backup-${randomUUID()}`)
    let hadContent = false

    try {
      await rename(target, backup)
      hadContent = true
    } catch (error) {
      if (!isMissing(error)) throw error
    }

    try {
      await rename(staging, target)
    } catch (error) {
      if (hadContent) await rename(backup, target).catch(() => undefined)
      throw error
    }

    if (hadContent) await rm(backup, { recursive: true, force: true }).catch(() => undefined)
  }

  private validateContent(files: Map<string, Buffer>): void {
    const text = (path: string): string => {
      const buffer = files.get(path)
      if (!buffer) throw new ContentError('invalid', `The content pack is missing ${path}.`)
      return buffer.toString('utf8')
    }

    toolLibrarySchema.parse(JSON.parse(text('tools.json')))
    checklistLibrarySchema.parse(JSON.parse(text('checklists.json')))
    parseDeviceRules(JSON.parse(text('devices.json')))

    const catalog = parseLessonLibrary(JSON.parse(text('lessons.json')))
    for (const lesson of catalog.lessons) {
      const body = files.get(lesson.bodyFile)
      if (!body) {
        throw new ContentError('invalid', `The lesson body ${lesson.bodyFile} is missing.`)
      }
      const bodyText = body.toString('utf8')
      if (bodyText.length < 40 || bodyText.length > 200_000) {
        throw new ContentError('invalid', `The lesson body ${lesson.bodyFile} is not usable.`)
      }
    }
  }

  private async readBundledManifest(): Promise<ContentManifest> {
    const raw = await readFile(join(this.options.bundledDirectory, CONTENT_MANIFEST_FILE), 'utf8')
    return parseContentManifest(JSON.parse(raw))
  }

  private async readUserManifest(): Promise<ContentManifest | null> {
    try {
      const raw = await readFile(join(this.options.userDirectory, CONTENT_MANIFEST_FILE), 'utf8')
      return parseContentManifest(JSON.parse(raw))
    } catch {
      return null
    }
  }

  private async fetchManifest(): Promise<ContentManifest> {
    const response = await this.fetchImpl(this.manifestUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { accept: 'application/json', 'user-agent': 'DroidCrate-content-update' },
      cache: 'no-store'
    }).catch((error: unknown) => {
      throw new ContentError('network', error instanceof Error ? error.message : String(error))
    })

    if (!response.ok) {
      throw new ContentError('network', `The content server returned HTTP ${response.status}.`)
    }

    const body = await response.text()
    if (Buffer.byteLength(body) > MANIFEST_LIMIT) {
      throw new ContentError('invalid', 'The content manifest is too large.')
    }

    try {
      return parseContentManifest(JSON.parse(body))
    } catch (error) {
      throw new ContentError(
        'invalid',
        error instanceof Error ? error.message : 'The content manifest is not valid.'
      )
    }
  }

  private async download(path: string): Promise<Buffer> {
    const url = `${this.remoteBase}/${path.split('/').map(encodeURIComponent).join('/')}`
    const response = await this.fetchImpl(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { 'user-agent': 'DroidCrate-content-update' },
      cache: 'no-store'
    }).catch((error: unknown) => {
      throw new ContentError('network', error instanceof Error ? error.message : String(error))
    })

    if (!response.ok) {
      throw new ContentError('network', `Downloading ${path} returned HTTP ${response.status}.`)
    }

    const declared = Number(response.headers.get('content-length') ?? '0')
    if (declared > FILE_LIMIT) {
      throw new ContentError('invalid', `${path} is larger than the limit.`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.byteLength > FILE_LIMIT) {
      throw new ContentError('invalid', `${path} is larger than the limit.`)
    }
    return buffer
  }
}
