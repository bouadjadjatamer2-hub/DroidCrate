import { app, ipcMain, shell } from 'electron'
import { IPC, type AppInfo } from '@shared/api'
import type { DeviceWatcher } from './device/watcher'

function isAllowedExternalUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function registerIpc(watcher: DeviceWatcher): void {
  ipcMain.handle(IPC.appInfo, (): AppInfo => {
    return {
      name: 'DroidCrate',
      version: app.getVersion(),
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
      platform: process.platform,
      isPackaged: app.isPackaged
    }
  })

  ipcMain.handle(IPC.openExternal, async (_event, url: unknown): Promise<boolean> => {
    if (typeof url !== 'string' || !isAllowedExternalUrl(url)) return false
    await shell.openExternal(url)
    return true
  })

  ipcMain.handle(IPC.deviceState, () => watcher.getState())

  ipcMain.handle(IPC.deviceRescan, () => watcher.scanNow())
}
