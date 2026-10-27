import { app } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export function dataDirectory(): string {
  return app.isPackaged ? join(process.resourcesPath, 'data') : join(app.getAppPath(), 'data')
}

export function userContentDirectory(): string {
  return join(app.getPath('userData'), 'content')
}

/**
 * Content files installed through the update flow live in the user data
 * directory. Each file falls back to the copy shipped with the application.
 */
export function resolveContentPath(relativePath: string): string {
  const userFile = join(userContentDirectory(), relativePath)
  if (existsSync(userFile)) return userFile
  return join(dataDirectory(), relativePath)
}

let revision = 0

/** Bumped after an update so every in-memory reader drops its cache. */
export function contentRevision(): number {
  return revision
}

export function invalidateContentCache(): void {
  revision += 1
}
