import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type AppInfo } from '@shared/api'

contextBridge.exposeInMainWorld('droidcrate', {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.appInfo),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke(IPC.openExternal, url)
})
