import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { autoUpdater as bundledUpdater } from 'electron-updater'
import {
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_SNOOZE_MS,
  UPDATE_STARTUP_DELAY_MS,
  type UpdateState
} from '@shared/updates'

/** The subset of electron-updater the service needs, kept small for tests. */
export interface UpdateInfoLike {
  version: string
  releaseName?: string | null
  releaseNotes?: string | Array<{ note?: string | null }> | null
  releaseDate?: string | null
}

export interface UpdateProgressLike {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export interface UpdaterLike {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  allowDowngrade: boolean
  allowPrerelease: boolean
  on(event: string, listener: (...args: never[]) => void): unknown
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<unknown>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
}

interface StoredPrefs {
  skippedVersion?: string
  snoozedUntil?: string
  lastCheckedAt?: string
}

export interface UpdateServiceOptions {
  currentVersion: string
  isPackaged: boolean
  storageFile: string
  onChange?: (state: UpdateState) => void
  loadUpdater?: () => Promise<UpdaterLike | null>
  now?: () => Date
}

function emptyState(currentVersion: string, supported: boolean): UpdateState {
  return {
    phase: supported ? 'idle' : 'disabled',
    supported,
    currentVersion,
    availableVersion: null,
    releaseName: null,
    releaseNotes: null,
    releaseDate: null,
    progress: null,
    bytesPerSecond: null,
    transferred: null,
    total: null,
    error: null,
    checkedAt: null,
    skippedVersion: null,
    snoozedUntil: null
  }
}

/** Compares dotted versions numerically; a prerelease is older than its base. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (value: string): { parts: number[]; prerelease: boolean } => {
    const [base, ...rest] = value.replace(/^v/i, '').split('-')
    const parts = (base ?? '0').split('.').map((part) => {
      const number = Number.parseInt(part, 10)
      return Number.isFinite(number) ? number : 0
    })
    return { parts, prerelease: rest.length > 0 }
  }

  const left = parse(candidate)
  const right = parse(current)
  const length = Math.max(left.parts.length, right.parts.length)
  for (let index = 0; index < length; index += 1) {
    const a = left.parts[index] ?? 0
    const b = right.parts[index] ?? 0
    if (a !== b) return a > b
  }
  if (left.prerelease !== right.prerelease) return !left.prerelease
  return false
}

/** Plain-text release notes: tags removed, whitespace folded, length capped. */
export function normalizeReleaseNotes(value: UpdateInfoLike['releaseNotes']): string | null {
  if (!value) return null
  // A string feed (GitHub HTML) becomes one readable paragraph; an array of
  // localized notes keeps one entry per line.
  const lines = Array.isArray(value)
    ? value.map((entry) => entry?.note ?? '')
    : [value]
  const clean = lines
    .map((line) =>
      line
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((line) => line.length > 0)
    .join('\n')
  if (!clean) return null
  return clean.length > 1200 ? `${clean.slice(0, 1200)}…` : clean
}

/**
 * Delivers application updates from the published GitHub release. Nothing is
 * downloaded until the owner presses Update, nothing is installed without a
 * second explicit confirmation, and "stay on this version" is remembered.
 */
export class UpdateService {
  private state: UpdateState
  private updater: UpdaterLike | null = null
  private loading: Promise<UpdaterLike | null> | null = null
  private prefs: StoredPrefs = {}
  private timer: NodeJS.Timeout | null = null
  private started = false

  constructor(private readonly options: UpdateServiceOptions) {
    this.state = emptyState(options.currentVersion, options.isPackaged)
  }

  getState(): UpdateState {
    return { ...this.state }
  }

  async initialize(): Promise<void> {
    await this.loadPrefs()
    this.state.checkedAt = this.prefs.lastCheckedAt ?? null
    this.emit()
  }

  /**
   * Checks shortly after launch and then every six hours. A skipped version
   * stays silent until a strictly newer one appears.
   */
  start(): void {
    if (!this.state.supported || this.started) return
    this.started = true
    setTimeout(() => void this.check(false), UPDATE_STARTUP_DELAY_MS).unref?.()
    this.timer = setInterval(() => void this.check(false), UPDATE_CHECK_INTERVAL_MS)
    this.timer.unref?.()
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async check(manual = false): Promise<UpdateState> {
    if (!this.state.supported) return this.getState()
    if (
      this.state.phase === 'checking' ||
      this.state.phase === 'downloading' ||
      // A downloaded update waiting for restart must not be replaced by a
      // background check; the owner decides when to install it.
      this.state.phase === 'ready'
    ) {
      return this.getState()
    }

    // A manual check means the owner changed their mind: forget "later" and
    // "stay on this version" so a hidden update is offered again.
    if (manual && (this.prefs.skippedVersion || this.prefs.snoozedUntil)) {
      await this.resume()
    }

    this.patch({ phase: 'checking', error: null, checkedAt: this.now().toISOString() })
    const updater = await this.getUpdater()
    if (!updater) {
      // getUpdater already recorded the reason; keep the app usable.
      return this.getState()
    }

    try {
      await updater.checkForUpdates()
    } catch (error) {
      // The error event usually fires first; keep the message either way.
      this.patch({
        phase: 'error',
        error: error instanceof Error ? error.message : String(error)
      })
    }
    return this.getState()
  }

  async download(): Promise<UpdateState> {
    if (!this.state.supported || !this.state.availableVersion) return this.getState()
    if (this.state.phase === 'downloading' || this.state.phase === 'ready') {
      return this.getState()
    }

    const updater = await this.getUpdater()
    if (!updater) return this.getState()

    this.patch({ phase: 'downloading', progress: 0, error: null })
    try {
      await updater.downloadUpdate()
    } catch (error) {
      this.patch({
        phase: 'error',
        error: error instanceof Error ? error.message : String(error)
      })
    }
    return this.getState()
  }

  /** Installs a fully downloaded update. Never installs without this call. */
  install(): boolean {
    if (this.state.phase !== 'ready' || !this.updater) return false
    const updater = this.updater
    setTimeout(() => updater.quitAndInstall(false, true), 250)
    return true
  }

  /** "Remind me later": hide the prompt, check again after a day. */
  async later(): Promise<UpdateState> {
    const until = new Date(this.now().getTime() + UPDATE_SNOOZE_MS).toISOString()
    this.patch({ snoozedUntil: until })
    await this.savePrefs({ snoozedUntil: until })
    return this.getState()
  }

  /** "Stay on this version": never remind for this exact version again. */
  async skip(): Promise<UpdateState> {
    const version = this.state.availableVersion
    if (!version) return this.getState()
    this.patch({ skippedVersion: version, snoozedUntil: null })
    await this.savePrefs({ skippedVersion: version, snoozedUntil: undefined })
    return this.getState()
  }

  /** Clears a previous "stay" choice; used by the manual check button. */
  async resume(): Promise<UpdateState> {
    this.patch({ skippedVersion: null, snoozedUntil: null })
    await this.savePrefs({ skippedVersion: undefined, snoozedUntil: undefined })
    return this.getState()
  }

  private now(): Date {
    return this.options.now?.() ?? new Date()
  }

  private patch(next: Partial<UpdateState>): void {
    this.state = { ...this.state, ...next }
    this.emit()
  }

  private emit(): void {
    this.options.onChange?.(this.getState())
  }

  private async getUpdater(): Promise<UpdaterLike | null> {
    if (this.updater) return this.updater
    if (this.loading) return this.loading

    this.loading = (async () => {
      const loader = this.options.loadUpdater ?? defaultUpdaterLoader
      try {
        const updater = await loader()
        if (!updater) return null
        updater.autoDownload = false
        updater.autoInstallOnAppQuit = false
        updater.allowDowngrade = false
        updater.allowPrerelease = false
        this.attach(updater)
        this.updater = updater
        return updater
      } catch (error) {
        this.patch({
          phase: 'error',
          error: error instanceof Error ? error.message : String(error)
        })
        return null
      } finally {
        this.loading = null
      }
    })()

    return this.loading
  }

  private attach(updater: UpdaterLike): void {
    updater.on('checking-for-update', () => {
      this.patch({ phase: 'checking', error: null })
    })

    updater.on('update-available', (...args: never[]) => {
      const info = args[0] as unknown as UpdateInfoLike
      const version = info?.version ?? null
      const skipped = this.prefs.skippedVersion ?? null
      // A genuinely newer release overrides an old "stay" choice.
      const skipApplies = Boolean(version && skipped && !isNewerVersion(version, skipped))
      if (!skipApplies && skipped) {
        this.prefs.skippedVersion = undefined
        void this.savePrefs({ skippedVersion: undefined })
      }
      this.patch({
        phase: 'available',
        availableVersion: version,
        releaseName: info?.releaseName ?? null,
        releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
        releaseDate: info?.releaseDate ?? null,
        progress: null,
        error: null,
        skippedVersion: skipApplies ? skipped : null,
        snoozedUntil: this.prefs.snoozedUntil ?? null
      })
    })

    updater.on('update-not-available', () => {
      const checkedAt = this.now().toISOString()
      this.patch({
        phase: 'up-to-date',
        availableVersion: null,
        progress: null,
        error: null,
        checkedAt
      })
      void this.savePrefs({ lastCheckedAt: checkedAt })
    })

    updater.on('download-progress', (...args: never[]) => {
      const progress = args[0] as unknown as UpdateProgressLike
      this.patch({
        phase: 'downloading',
        progress: Math.max(0, Math.min(100, Math.round(progress?.percent ?? 0))),
        bytesPerSecond: progress?.bytesPerSecond ?? null,
        transferred: progress?.transferred ?? null,
        total: progress?.total ?? null
      })
    })

    updater.on('update-downloaded', (...args: never[]) => {
      const info = args[0] as unknown as UpdateInfoLike
      this.patch({
        phase: 'ready',
        availableVersion: info?.version ?? this.state.availableVersion,
        progress: 100
      })
    })

    updater.on('error', (...args: never[]) => {
      const error = args[0] as unknown
      this.patch({
        phase: 'error',
        error: error instanceof Error ? error.message : String(error)
      })
    })
  }

  private async loadPrefs(): Promise<void> {
    try {
      const raw = await readFile(this.options.storageFile, 'utf8')
      const parsed = JSON.parse(raw) as StoredPrefs
      this.prefs = {
        skippedVersion:
          typeof parsed.skippedVersion === 'string' ? parsed.skippedVersion : undefined,
        snoozedUntil: typeof parsed.snoozedUntil === 'string' ? parsed.snoozedUntil : undefined,
        lastCheckedAt:
          typeof parsed.lastCheckedAt === 'string' ? parsed.lastCheckedAt : undefined
      }
      this.state.skippedVersion = this.prefs.skippedVersion ?? null
      this.state.snoozedUntil = this.prefs.snoozedUntil ?? null
    } catch {
      this.prefs = {}
    }
  }

  private async savePrefs(next: StoredPrefs): Promise<void> {
    this.prefs = { ...this.prefs, ...next }
    for (const key of Object.keys(this.prefs) as Array<keyof StoredPrefs>) {
      if (this.prefs[key] === undefined) delete this.prefs[key]
    }
    try {
      await mkdir(dirname(this.options.storageFile), { recursive: true })
      await writeFile(this.options.storageFile, `${JSON.stringify(this.prefs, null, 2)}\n`, 'utf8')
    } catch {
      // Preferences are a convenience; a failed write must not break the app.
    }
  }
}

async function defaultUpdaterLoader(): Promise<UpdaterLike | null> {
  // A static import is required here: Electron's ESM loader cannot reliably
  // resolve a dynamic import from inside app.asar on Windows.
  return bundledUpdater as unknown as UpdaterLike
}
