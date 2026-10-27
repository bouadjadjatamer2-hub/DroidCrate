import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { get as httpsGet, type RequestOptions } from 'node:https'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { BrowserWindow } from 'electron'
import extract from 'extract-zip'
import { IPC } from '@shared/api'
import type {
  PlatformToolsCatalog,
  PlatformToolsProgress,
  PlatformToolsStatus
} from '@shared/platformTools'
import { parseAdbVersion } from '@shared/adb'

const execFileAsync = promisify(execFile)
const MAX_REDIRECTS = 4

interface DownloadResult {
  bytes: number
  sha256: string
}

interface InstallMarker {
  version: string
  sha256: string
  source: string
  installedAt: string
}

function exists(path: string): Promise<boolean> {
  return access(path)
    .then(() => true)
    .catch(() => false)
}

function isOfficialSource(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'dl.google.com' && url.pathname.startsWith('/android/repository/')
  } catch {
    return false
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return 'The download was cancelled.'
    return error.message
  }
  return 'Unexpected error'
}

async function removeQuietly(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true }).catch(() => undefined)
}

function downloadFile(
  source: string,
  destination: string,
  expectedBytes: number,
  signal: AbortSignal,
  onProgress: (progress: PlatformToolsProgress) => void
): Promise<DownloadResult> {
  return new Promise((resolve, reject) => {
    let settled = false
    let redirects = 0
    let lastProgress = 0
    let received = 0

    const fail = (error: Error): void => {
      if (settled) return
      settled = true
      reject(error)
    }

    const request = (url: string): void => {
      if (signal.aborted) {
        fail(new Error('The download was cancelled.'))
        return
      }

      const options: RequestOptions = {
        headers: {
          Accept: 'application/zip, application/octet-stream',
          'User-Agent': 'DroidCrate/0.1 PlatformToolsInstaller'
        },
        signal
      }

      const req = httpsGet(url, options, (response) => {
        const status = response.statusCode ?? 0
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume()
          redirects += 1
          if (redirects > MAX_REDIRECTS) {
            fail(new Error('The download redirected too many times.'))
            return
          }
          const next = new URL(response.headers.location, url).toString()
          if (!isOfficialSource(next)) {
            fail(new Error('The download tried to leave Google\'s official repository.'))
            return
          }
          request(next)
          return
        }

        if (status !== 200) {
          response.resume()
          fail(new Error(`Google returned HTTP ${status}. Try again later.`))
          return
        }

        const declared = Number(response.headers['content-length'] ?? 0)
        if (declared > 0 && declared !== expectedBytes) {
          response.resume()
          fail(
            new Error(
              'The official archive size changed. Google may have published a new build; update data/platform-tools.json before installing again.'
            )
          )
          return
        }

        const hash = createHash('sha256')
        const file = createWriteStream(destination, { flags: 'w' })
        let finished = false

        const finish = (error?: Error): void => {
          if (finished) return
          finished = true
          const settle = (closeError?: Error | null): void => {
            if (error) {
              fail(error)
              return
            }
            if (closeError) {
              fail(closeError)
              return
            }
            if (received !== expectedBytes) {
              fail(
                new Error(
                  `The download was incomplete (${received} of ${expectedBytes} bytes). Check the connection and try again.`
                )
              )
              return
            }
            if (settled) return
            settled = true
            resolve({ bytes: received, sha256: hash.digest('hex') })
          }
          try {
            file.close(settle)
          } catch (closeError) {
            settle(closeError instanceof Error ? closeError : new Error('The download file could not be closed.'))
          }
        }

        response.on('data', (chunk: Buffer) => {
          if (settled) return
          received += chunk.length
          if (received > expectedBytes) {
            response.destroy()
            finish(new Error('The download was larger than the official archive size.'))
            return
          }
          hash.update(chunk)
          file.write(chunk)
          const now = Date.now()
          if (now - lastProgress > 150) {
            lastProgress = now
            onProgress({
              receivedBytes: received,
              totalBytes: expectedBytes,
              percent: Math.min(99.5, (received / expectedBytes) * 100)
            })
          }
        })

        response.on('error', (error) => finish(error))
        response.on('aborted', () => finish(new Error('The download connection closed early.')))
        response.on('end', () => {
          file.on('finish', () => finish())
          file.end()
        })

        file.on('error', (error) => {
          response.destroy()
          finish(error)
        })

        signal.addEventListener(
          'abort',
          () => {
            response.destroy()
            finish(new Error('The download was cancelled.'))
          },
          { once: true }
        )
      })

      req.setTimeout(30_000, () => {
        req.destroy(new Error('The download timed out after 30 seconds without data.'))
      })
      req.on('error', (error) => fail(error))
    }

    request(source)
  })
}

async function hashFile(path: string): Promise<{ bytes: number; sha256: string }> {
  const hash = createHash('sha256')
  let bytes = 0
  for await (const chunk of createReadStream(path)) {
    const buffer = chunk as Buffer
    bytes += buffer.length
    hash.update(buffer)
  }
  return { bytes, sha256: hash.digest('hex') }
}

async function readAdbVersion(adbPath: string): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(adbPath, ['version'], {
      timeout: 10_000,
      windowsHide: true,
      maxBuffer: 256 * 1024
    })
    return parseAdbVersion(`${stdout}\n${stderr}`)
  } catch {
    return null
  }
}

export class PlatformToolsService {
  private status: PlatformToolsStatus
  private active: Promise<PlatformToolsStatus> | null = null
  private controller: AbortController | null = null
  private readonly root: string
  private readonly currentDir: string
  private readonly downloadsDir: string

  constructor(
    private readonly catalog: PlatformToolsCatalog,
    userDataPath: string
  ) {
    this.root = join(userDataPath, 'platform-tools')
    this.currentDir = join(this.root, 'current')
    this.downloadsDir = join(this.root, 'downloads')
    this.status = {
      stage: 'idle',
      installed: false,
      version: null,
      expectedVersion: catalog.version,
      releasePage: catalog.source.releasePage,
      sourceUrl: catalog.url,
      sourceSizeBytes: catalog.sizeBytes,
      expectedSha256: catalog.sha256,
      installPath: null,
      progress: null,
      error: null,
      checkedAt: new Date().toISOString()
    }
  }

  async initialize(): Promise<void> {
    await this.detectInstalled()
  }

  getStatus(): PlatformToolsStatus {
    return { ...this.status, progress: this.status.progress ? { ...this.status.progress } : null }
  }

  getCatalog(): PlatformToolsCatalog {
    return this.catalog
  }

  getAdbPath(): string | null {
    return this.status.stage === 'ready' ? join(this.currentDir, 'adb.exe') : null
  }

  getFastbootPath(): string | null {
    return this.status.stage === 'ready' ? join(this.currentDir, 'fastboot.exe') : null
  }

  async detectInstalled(): Promise<PlatformToolsStatus> {
    const adbPath = join(this.currentDir, 'adb.exe')
    const markerPath = join(this.currentDir, 'droidcrate-install.json')
    const hasAdb = await exists(adbPath)

    if (!hasAdb) {
      this.patch({
        stage: 'idle',
        installed: false,
        version: null,
        installPath: null,
        progress: null,
        error: null
      })
      return this.getStatus()
    }

    const version = await readAdbVersion(adbPath)
    if (!version) {
      this.patch({
        stage: 'error',
        installed: false,
        version: null,
        installPath: this.currentDir,
        progress: null,
        error:
          'Platform Tools files are present but adb.exe could not start. Reinstall to repair the installation.'
      })
      return this.getStatus()
    }

    let marker: InstallMarker | null = null
    try {
      marker = JSON.parse(await readFile(markerPath, 'utf8')) as InstallMarker
    } catch {
      marker = null
    }

    this.patch({
      stage: 'ready',
      installed: true,
      version,
      installPath: this.currentDir,
      progress: null,
      error: marker ? null : 'Installed outside this installer. Source and checksum were not recorded locally.'
    })
    return this.getStatus()
  }

  install(): Promise<PlatformToolsStatus> {
    if (this.active) return this.active
    this.active = this.runInstall().finally(() => {
      this.active = null
      this.controller = null
    })
    return this.active
  }

  cancel(): void {
    this.controller?.abort()
  }

  private async runInstall(): Promise<PlatformToolsStatus> {
    if (!isOfficialSource(this.catalog.url)) {
      this.patch({ stage: 'error', error: 'The Platform Tools source is not an official Google URL.' })
      return this.getStatus()
    }

    const controller = new AbortController()
    this.controller = controller
    const id = randomUUID()
    const zipPath = join(this.downloadsDir, `platform-tools-${id}.zip`)
    const stagingDir = join(this.root, `.staging-${id}`)
    const backupDir = join(this.root, `.previous-${id}`)
    let payloadDir: string | null = null

    try {
      await mkdir(this.downloadsDir, { recursive: true })
      await removeQuietly(stagingDir)

      this.patch({
        stage: 'downloading',
        installed: false,
        progress: { receivedBytes: 0, totalBytes: this.catalog.sizeBytes, percent: 0 },
        error: null
      })

      const download = await downloadFile(
        this.catalog.url,
        zipPath,
        this.catalog.sizeBytes,
        controller.signal,
        (progress) => this.patch({ progress })
      )

      this.patch({ stage: 'verifying', progress: null })

      if (download.sha256 !== this.catalog.sha256) {
        throw new Error(
          'SHA-256 verification failed. The archive was deleted and nothing was installed. Google may have published a new build; update data/platform-tools.json first.'
        )
      }

      const onDisk = await hashFile(zipPath)
      if (onDisk.bytes !== download.bytes || onDisk.sha256 !== this.catalog.sha256) {
        throw new Error(
          `The archive on disk did not match the verified download (${onDisk.bytes} of ${download.bytes} bytes). Check free disk space and try again.`
        )
      }

      this.patch({ stage: 'extracting' })
      await mkdir(stagingDir, { recursive: true })
      await extract(zipPath, { dir: stagingDir })
      await removeQuietly(zipPath)

      const nested = join(stagingDir, 'platform-tools')
      const candidate = (await exists(join(nested, 'adb.exe'))) ? nested : stagingDir
      if (!(await exists(join(candidate, 'adb.exe'))) || !(await exists(join(candidate, 'fastboot.exe')))) {
        throw new Error('The official archive did not contain adb.exe and fastboot.exe.')
      }
      payloadDir = candidate

      this.patch({ stage: 'installing' })
      await this.stopRunningAdb()
      await this.swapInstall(payloadDir, backupDir)
      payloadDir = null

      const adbPath = join(this.currentDir, 'adb.exe')
      const version = await readAdbVersion(adbPath)
      if (!version) {
        throw new Error('The new Platform Tools installation could not start adb.exe.')
      }

      const marker: InstallMarker = {
        version,
        sha256: this.catalog.sha256,
        source: this.catalog.url,
        installedAt: new Date().toISOString()
      }
      await writeFile(join(this.currentDir, 'droidcrate-install.json'), `${JSON.stringify(marker, null, 2)}\n`, 'utf8')

      this.patch({
        stage: 'ready',
        installed: true,
        version,
        installPath: this.currentDir,
        progress: null,
        error: null
      })
      return this.getStatus()
    } catch (error) {
      const message = errorText(error)
      if (controller.signal.aborted) {
        await this.restoreBackup(backupDir)
        this.patch({
          stage: 'idle',
          installed: false,
          version: null,
          installPath: null,
          progress: null,
          error: null
        })
      } else {
        await this.restoreBackup(backupDir)
        const restored = await this.detectInstalled()
        this.patch({
          stage: 'error',
          installed: restored.installed,
          version: restored.version,
          installPath: restored.installPath,
          progress: null,
          error: restored.installed
            ? `${message} Your previous Platform Tools installation was kept.`
            : message
        })
      }
      return this.getStatus()
    } finally {
      await removeQuietly(zipPath)
      await removeQuietly(stagingDir)
      if (payloadDir) await removeQuietly(payloadDir)
      await removeQuietly(backupDir)
      controller.abort()
    }
  }

  private async swapInstall(payloadDir: string, backupDir: string): Promise<void> {
    let movedOld = false
    if (await exists(this.currentDir)) {
      try {
        await rename(this.currentDir, backupDir)
        movedOld = true
      } catch {
        await this.stopRunningAdb()
        await new Promise((resolve) => setTimeout(resolve, 600))
        try {
          await rename(this.currentDir, backupDir)
          movedOld = true
        } catch {
          throw new Error(
            'Platform Tools is in use. Close terminals, Android Studio, or other adb.exe processes, then try again.'
          )
        }
      }
    }

    try {
      await rename(payloadDir, this.currentDir)
    } catch (error) {
      if (movedOld) await rename(backupDir, this.currentDir).catch(() => undefined)
      throw new Error(
        `The verified files could not be moved into place. ${errorText(error)} Close adb.exe and try again.`
      )
    }
  }

  private async restoreBackup(backupDir: string): Promise<void> {
    if (!(await exists(backupDir))) return
    if (await exists(this.currentDir)) {
      await removeQuietly(this.currentDir)
    }
    await rename(backupDir, this.currentDir).catch(() => undefined)
  }

  private async stopRunningAdb(): Promise<void> {
    const adbPath = join(this.currentDir, 'adb.exe')
    if (!(await exists(adbPath))) return
    await execFileAsync(adbPath, ['kill-server'], {
      timeout: 5_000,
      windowsHide: true,
      maxBuffer: 64 * 1024
    }).catch(() => undefined)
  }

  private patch(update: Partial<PlatformToolsStatus>): void {
    this.status = {
      ...this.status,
      ...update,
      checkedAt: new Date().toISOString()
    }
    this.broadcast()
  }

  private broadcast(): void {
    const snapshot = this.getStatus()
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC.platformToolsUpdate, snapshot)
      }
    }
  }
}
