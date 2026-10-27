import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  diffContent,
  parseContentManifest,
  type ContentManifest
} from '@shared/contentUpdate'
import { ContentService } from '../src/main/content/service'

const project = process.cwd()
const dataDir = join(project, 'data')
const remoteBase = 'https://content.test/data'
const bodyPath = 'lessons/android-boot-chain.md'
const extraBody = '\n\n## Update test\n\nThis paragraph only exists in the test fixture.\n'
const cleanup: Array<() => void> = []

afterEach(() => {
  while (cleanup.length > 0) cleanup.pop()?.()
})

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

function shippedManifest(): ContentManifest {
  return parseContentManifest(
    JSON.parse(readFileSync(join(dataDir, 'content-manifest.json'), 'utf8'))
  )
}

function updatedManifest(base: ContentManifest, body: Buffer): ContentManifest {
  return {
    ...base,
    contentVersion: '2026.10.28',
    generatedAt: new Date().toISOString(),
    files: base.files.map((file) =>
      file.path === bodyPath
        ? { ...file, bytes: body.byteLength, sha256: sha256(body) }
        : file
    )
  }
}

function fetchFor(
  manifest: ContentManifest,
  overrides: Record<string, Buffer> = {}
): typeof fetch {
  return async (input) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url === `${remoteBase}/content-manifest.json`) {
      return new Response(JSON.stringify(manifest), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    const path = decodeURIComponent(url.slice(remoteBase.length + 1))
    const buffer = overrides[path] ?? readFileSync(join(dataDir, path))
    return new Response(buffer, {
      status: 200,
      headers: { 'content-length': String(buffer.byteLength) }
    })
  }
}

function createWorkspace(): {
  bundled: string
  user: string
  service: (manifest: ContentManifest, overrides?: Record<string, Buffer>) => ContentService
} {
  const root = mkdtempSync(join(tmpdir(), 'droidcrate-content-'))
  const bundled = join(root, 'bundled')
  const user = join(root, 'content')
  cpSync(dataDir, bundled, { recursive: true })
  cleanup.push(() => rmSync(root, { recursive: true, force: true }))

  return {
    bundled,
    user,
    service: (manifest, overrides) =>
      new ContentService({
        bundledDirectory: bundled,
        userDirectory: user,
        fetchImpl: fetchFor(manifest, overrides),
        manifestUrl: `${remoteBase}/content-manifest.json`,
        remoteBase
      })
  }
}

describe('content manifest', () => {
  it('matches every shipped content file', () => {
    const manifest = shippedManifest()

    for (const file of manifest.files) {
      const buffer = readFileSync(join(dataDir, file.path))
      expect(buffer.byteLength, file.path).toBe(file.bytes)
      expect(sha256(buffer), file.path).toBe(file.sha256)
    }

    const bodies = readdirSync(join(dataDir, 'lessons')).filter((file) => file.endsWith('.md'))
    const listed = manifest.files.filter((file) => file.path.startsWith('lessons/'))
    expect(listed).toHaveLength(bodies.length)
  })

  it('rejects unsafe paths, duplicates, and missing core files', () => {
    const base = shippedManifest()

    const traversal = structuredClone(base) as ContentManifest
    traversal.files[0] = { ...traversal.files[0], path: '../escape.json' }
    expect(() => parseContentManifest(traversal)).toThrow()

    const absolute = structuredClone(base) as ContentManifest
    absolute.files[0] = { ...absolute.files[0], path: '/etc/tools.json' }
    expect(() => parseContentManifest(absolute)).toThrow()

    const wrongExtension = structuredClone(base) as ContentManifest
    wrongExtension.files[0] = { ...wrongExtension.files[0], path: 'tools.exe' }
    expect(() => parseContentManifest(wrongExtension)).toThrow()

    const duplicate = structuredClone(base) as ContentManifest
    duplicate.files.push({ ...duplicate.files[0] })
    expect(() => parseContentManifest(duplicate)).toThrow()

    const missing = structuredClone(base) as ContentManifest
    missing.files = missing.files.filter((file) => file.path !== 'tools.json')
    expect(() => parseContentManifest(missing)).toThrow()
  })

  it('reports added, changed, and removed files', () => {
    const base = shippedManifest()
    const body = Buffer.from(readFileSync(join(dataDir, bodyPath), 'utf8') + extraBody)
    const next = updatedManifest(base, body)
    next.files = next.files.filter((file) => file.path !== 'devices.json')
    next.files.push({ path: 'lessons/new-lesson.md', sha256: 'a'.repeat(64), bytes: 512 })

    const changes = diffContent(base, next)
    expect(changes.find((change) => change.path === bodyPath)?.reason).toBe('changed')
    expect(changes.find((change) => change.path === 'devices.json')?.reason).toBe('removed')
    expect(changes.find((change) => change.path === 'lessons/new-lesson.md')?.reason).toBe(
      'added'
    )
  })
})

describe('content updates', () => {
  it('checks, verifies, and installs a content pack', async () => {
    const workspace = createWorkspace()
    const body = Buffer.from(readFileSync(join(dataDir, bodyPath), 'utf8') + extraBody)
    const manifest = updatedManifest(shippedManifest(), body)
    const service = workspace.service(manifest, { [bodyPath]: body })

    const before = await service.getStatus()
    expect(before.source).toBe('bundled')

    const check = await service.check()
    expect(check.error).toBeNull()
    expect(check.available).toBe(true)
    expect(check.remoteVersion).toBe('2026.10.28')
    expect(check.changes.map((change) => change.path)).toContain(bodyPath)

    const applied = await service.apply('2026.10.28')
    expect(applied.installed).toBe(true)
    expect(applied.error).toBeNull()
    expect(existsSync(join(workspace.user, 'content-manifest.json'))).toBe(true)
    expect(readFileSync(join(workspace.user, bodyPath), 'utf8')).toContain('Update test')

    const after = await service.getStatus()
    expect(after.source).toBe('user')
    expect(after.contentVersion).toBe('2026.10.28')

    const recheck = await service.check()
    expect(recheck.available).toBe(false)
    expect(recheck.changes).toEqual([])
  })

  it('refuses a manifest that changed after the confirmation', async () => {
    const workspace = createWorkspace()
    const body = Buffer.from(readFileSync(join(dataDir, bodyPath), 'utf8') + extraBody)
    const manifest = updatedManifest(shippedManifest(), body)
    const service = workspace.service(manifest, { [bodyPath]: body })

    const applied = await service.apply('2026.10.27')
    expect(applied.installed).toBe(false)
    expect(applied.error).toBe('version')
    expect(existsSync(workspace.user)).toBe(false)
  })

  it('rejects hash mismatches and leaves the previous content intact', async () => {
    const workspace = createWorkspace()
    const body = Buffer.from(readFileSync(join(dataDir, bodyPath), 'utf8') + extraBody)
    const manifest = updatedManifest(shippedManifest(), body)
    manifest.files = manifest.files.map((file) =>
      file.path === bodyPath ? { ...file, sha256: '0'.repeat(64) } : file
    )
    const service = workspace.service(manifest, { [bodyPath]: body })

    const applied = await service.apply('2026.10.28')
    expect(applied.installed).toBe(false)
    expect(applied.error).toBe('hash')
    expect(existsSync(workspace.user)).toBe(false)
  })

  it('rejects content that fails schema validation', async () => {
    const workspace = createWorkspace()
    const base = shippedManifest()
    const broken = Buffer.from('{ "not": "a tool library" }')
    const manifest: ContentManifest = {
      ...base,
      contentVersion: '2026.10.29',
      files: base.files.map((file) =>
        file.path === 'tools.json'
          ? { ...file, bytes: broken.byteLength, sha256: sha256(broken) }
          : file
      )
    }
    const service = workspace.service(manifest, { 'tools.json': broken })

    const applied = await service.apply('2026.10.29')
    expect(applied.installed).toBe(false)
    expect(applied.error).toBe('invalid')
    expect(existsSync(workspace.user)).toBe(false)
  })

  it('resets installed content back to the bundled copy', async () => {
    const workspace = createWorkspace()
    const body = Buffer.from(readFileSync(join(dataDir, bodyPath), 'utf8') + extraBody)
    const manifest = updatedManifest(shippedManifest(), body)
    const service = workspace.service(manifest, { [bodyPath]: body })

    expect((await service.apply('2026.10.28')).installed).toBe(true)
    expect((await service.getStatus()).source).toBe('user')

    const restored = await service.reset()
    expect(restored.source).toBe('bundled')
    expect(restored.contentVersion).toBe(shippedManifest().contentVersion)
    expect(existsSync(workspace.user)).toBe(false)
  })

  it('reports a network failure without changing anything', async () => {
    const workspace = createWorkspace()
    const service = new ContentService({
      bundledDirectory: workspace.bundled,
      userDirectory: workspace.user,
      fetchImpl: async () => {
        throw new TypeError('fetch failed')
      },
      manifestUrl: `${remoteBase}/content-manifest.json`,
      remoteBase
    })

    const check = await service.check()
    expect(check.available).toBe(false)
    expect(check.error).toBe('network')
    expect(existsSync(workspace.user)).toBe(false)
  })
})
