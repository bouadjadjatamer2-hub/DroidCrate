import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type AppInfo } from '@shared/api'
import type { DeviceState } from '@shared/device'
import type { ToolLibrary } from '@shared/tools'
import type { ChecklistLibrary } from '@shared/checklists'

contextBridge.exposeInMainWorld('droidcrate', {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.appInfo),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke(IPC.openExternal, url),
  getDeviceState: (): Promise<DeviceState> => ipcRenderer.invoke(IPC.deviceState),
  rescanDevices: (): Promise<DeviceState> => ipcRenderer.invoke(IPC.deviceRescan),
  getToolLibrary: (): Promise<ToolLibrary> => ipcRenderer.invoke(IPC.toolsList),
  getChecklistLibrary: (): Promise<ChecklistLibrary> => ipcRenderer.invoke(IPC.checklistsList),
  onDeviceUpdate: (listener: (state: DeviceState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: DeviceState): void => listener(state)
    ipcRenderer.on(IPC.deviceUpdate, handler)
    return () => ipcRenderer.removeListener(IPC.deviceUpdate, handler)
  }
})
