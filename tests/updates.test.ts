import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  UpdateService,
  isNewerVersion,
  normalizeReleaseNotes,
  type UpdaterLike
} from '../src/main/updates/service'

const cleanup: Array<() => void> = []

afterEach(() => {
  while (cleanup.length > 0) cleanup.pop()?.()
  vi.useRealTimers()
})

interface FakeInfo {
  version: string
  releaseName?: string
  releaseNotes?: string
  releaseDate?: string
}

/**
 * Mimics electron-updater closely enough: events fire while the awaited
 * check/download promise is still pending, never before it starts.
 */
class FakeUpdater implements UpdaterLike {
  autoDownload = true
  autoInstallOnAppQuit = true
  allowDowngrade = true
  allowPrerelease = true
  quitAndInstall = vi.fn()
  downloadUpdate = vi.fn(async () => {
    this.emit('download-progress', {
      percent: 42.4,
      bytesPerSecond: 1024,
      transferred: 42,
      total: 100
    })
    this.emit('update-downloaded', { version: this.nextVersion ?? '0.2.3' })
  })

  checkForUpdates = vi.fn(async () => {
    this.emit('checking-for-update')
    if (this.nextError) {
      this.emit('error', this.nextError)
      return
    }
    if (this.nextInfo) {
      this.emit('update-available', this.nextInfo)
      return
    }
    this.emit('update-not-available', { version: '0.2.2' })
  })

  private readonly listeners = new Map<string, Array<(...args: unknown[]) => void>>()
  private nextInfo: FakeInfo | null = null
  private nextError: Error | null = null
  private nextVersion: string | null = null

  on(event: string, listener: (...args: never[]) => void): this {
    const list = this.listeners.get(event) ?? []
    list.push(listener as unknown as (...args: unknown[]) => void)
    this.listeners.set(event, list)
    return this
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args)
  }

  /** Queue what the next check should report. */
  offer(info: FakeInfo): void {
    this.nextInfo = info
    this.nextError = null
    this.nextVersion = info.version
  }

  none(): void {
    this.nextInfo = null
    this.nextError = null
  }

  fail(error: Error): void {
    this.nextInfo = null
    this.nextError = error
  }
}

function storageFile(): string {
  const directory = mkdtempSync(join(tmpdir(), 'droidcrate-update-'))
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }))
  return join(directory, 'updates.json')
}

function createService(options?: {
  packaged?: boolean
  now?: () => Date
  updater?: FakeUpdater
}) {
  const updater = options?.updater ?? new FakeUpdater()
  const file = storageFile()
  const states: string[] = []
  const service = new UpdateService({
    currentVersion: '0.2.2',
    isPackaged: options?.packaged ?? true,
    storageFile: file,
    loadUpdater: async () => updater,
    now: options?.now,
    onChange: (state) => states.push(state.phase)
  })
  return { service, updater, file, states }
}

describe('version helpers', () => {
  it('compares dotted versions and prereleases', () => {
    expect(isNewerVersion('0.2.3', '0.2.2')).toBe(true)
    expect(isNewerVersion('0.10.0', '0.9.9')).toBe(true)
    expect(isNewerVersion('0.2.2', '0.2.2')).toBe(false)
    expect(isNewerVersion('0.2.2', '0.2.3')).toBe(false)
    expect(isNewerVersion('1.0.0', '1.0.0-beta.1')).toBe(true)
    expect(isNewerVersion('1.0.0-beta.1', '1.0.0')).toBe(false)
  })

  it('turns release notes into short plain text', () => {
    expect(normalizeReleaseNotes(undefined)).toBeNull()
    expect(normalizeReleaseNotes('<b>Fixed</b>\n\n\n items')).toBe('Fixed items')
    expect(normalizeReleaseNotes([{ note: 'A' }, { note: 'B' }])).toBe('A\nB')
    expect(normalizeReleaseNotes('x'.repeat(2000))?.endsWith('…')).toBe(true)
  })
})

describe('UpdateService', () => {
  it('is disabled in development and never loads a feed', async () => {
    const loadUpdater = vi.fn()
    const service = new UpdateService({
      currentVersion: '0.2.2',
      isPackaged: false,
      storageFile: storageFile(),
      loadUpdater
    })
    await service.initialize()

    expect(service.getState().phase).toBe('disabled')
    expect(service.getState().supported).toBe(false)
    expect(await service.check(true)).toMatchObject({ phase: 'disabled' })
    expect(loadUpdater).not.toHaveBeenCalled()
  })

  it('reports an available version with its notes', async () => {
    const { service, updater, states } = createService()
    await service.initialize()

    updater.offer({
      version: '0.2.3',
      releaseName: 'DroidCrate 0.2.3',
      releaseNotes: '<p>Faster updates</p>',
      releaseDate: '2026-11-14T00:00:00.000Z'
    })
    await service.check(true)

    const state = service.getState()
    expect(state.phase).toBe('available')
    expect(state.availableVersion).toBe('0.2.3')
    expect(state.releaseNotes).toBe('Faster updates')
    expect(state.error).toBeNull()
    expect(states).toContain('checking')
    expect(states).toContain('available')
  })

  it('reports up to date and records the check time', async () => {
    const now = () => new Date('2026-11-14T10:00:00.000Z')
    const { service, updater } = createService({ now })
    await service.initialize()

    updater.none()
    await service.check(true)

    expect(service.getState()).toMatchObject({
      phase: 'up-to-date',
      checkedAt: '2026-11-14T10:00:00.000Z',
      availableVersion: null
    })
  })

  it('surfaces feed errors without blocking the app', async () => {
    const { service, updater } = createService()
    await service.initialize()

    updater.fail(new Error('HttpError: 404'))
    await service.check(false)

    expect(service.getState().phase).toBe('error')
    expect(service.getState().error).toContain('404')
  })

  it('downloads only after a version is offered, then becomes ready', async () => {
    const { service, updater } = createService()
    await service.initialize()

    expect(await service.download()).toMatchObject({ phase: 'idle' })

    updater.offer({ version: '0.2.3' })
    await service.check(true)

    await service.download()

    expect(service.getState()).toMatchObject({
      phase: 'ready',
      progress: 100,
      availableVersion: '0.2.3'
    })
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1)
  })

  it('installs only when ready and only after an explicit call', async () => {
    vi.useFakeTimers()
    const { service, updater } = createService()
    await service.initialize()

    expect(service.install()).toBe(false)

    updater.offer({ version: '0.2.3' })
    await service.check(true)
    expect(service.install()).toBe(false)

    await service.download()
    expect(service.getState().phase).toBe('ready')

    // A background check must not throw away a downloaded update.
    const checks = updater.checkForUpdates.mock.calls.length
    updater.offer({ version: '0.2.3' })
    await service.check(false)
    expect(service.getState().phase).toBe('ready')
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(checks)

    expect(service.install()).toBe(true)
    vi.advanceTimersByTime(300)
    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true)
  })

  it('remembers "stay on this version" across restarts', async () => {
    const { service, updater, file } = createService()
    await service.initialize()
    updater.offer({ version: '0.2.3' })
    await service.check(true)

    expect(await service.skip()).toMatchObject({ skippedVersion: '0.2.3' })

    const restarted = new UpdateService({
      currentVersion: '0.2.2',
      isPackaged: true,
      storageFile: file,
      loadUpdater: async () => updater
    })
    await restarted.initialize()
    expect(restarted.getState().skippedVersion).toBe('0.2.3')

    // The same version stays skipped; a newer one is offered again.
    updater.offer({ version: '0.2.3' })
    await restarted.check(false)
    expect(restarted.getState().skippedVersion).toBe('0.2.3')

    updater.offer({ version: '0.2.4' })
    await restarted.check(false)
    expect(restarted.getState()).toMatchObject({
      phase: 'available',
      availableVersion: '0.2.4',
      skippedVersion: null
    })
  })

  it('a manual check clears a previous skip', async () => {
    const { service, updater } = createService()
    await service.initialize()
    updater.offer({ version: '0.2.3' })
    await service.check(true)
    await service.skip()

    updater.offer({ version: '0.2.3' })
    await service.check(true)

    expect(service.getState().skippedVersion).toBeNull()
    expect(service.getState().phase).toBe('available')
  })

  it('snoozes reminders for one day', async () => {
    const now = () => new Date('2026-11-14T09:00:00.000Z')
    const { service, updater } = createService({ now })
    await service.initialize()
    updater.offer({ version: '0.2.3' })
    await service.check(true)

    expect(await service.later()).toMatchObject({
      snoozedUntil: '2026-11-15T09:00:00.000Z'
    })
  })

  it('spaces checks apart and ignores re-entrant checks', async () => {
    const { service, updater } = createService()
    await service.initialize()

    updater.offer({ version: '0.2.3' })
    const first = service.check(true)
    // A second call while the first is still checking is a no-op.
    expect(await service.check(true)).toMatchObject({ phase: 'checking' })
    await first
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
  })
})
