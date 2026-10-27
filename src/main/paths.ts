import { app } from 'electron'
import { join } from 'node:path'

export function dataDirectory(): string {
  return app.isPackaged ? join(process.resourcesPath, 'data') : join(app.getAppPath(), 'data')
}

export function userContentDirectory(): string {
  return join(app.getPath('userData'), 'content')
}
