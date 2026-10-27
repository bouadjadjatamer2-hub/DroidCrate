import type { DeviceState } from './device'
import type { ToolLibrary } from './tools'
import type { ChecklistLibrary } from './checklists'

export type SectionId = 'device' | 'tools' | 'checklists' | 'lessons' | 'history' | 'settings'

export interface AppInfo {
  name: string
  version: string
  electron: string
  node: string
  chrome: string
  platform: string
  isPackaged: boolean
}

export interface DroidCrateApi {
  getAppInfo(): Promise<AppInfo>
  openExternal(url: string): Promise<boolean>
  getDeviceState(): Promise<DeviceState>
  rescanDevices(): Promise<DeviceState>
  onDeviceUpdate(listener: (state: DeviceState) => void): () => void
  getToolLibrary(): Promise<ToolLibrary>
  getChecklistLibrary(): Promise<ChecklistLibrary>
}

export const IPC = {
  appInfo: 'app:info',
  openExternal: 'app:open-external',
  deviceState: 'device:state',
  deviceRescan: 'device:rescan',
  deviceUpdate: 'device:update',
  toolsList: 'tools:list',
  checklistsList: 'checklists:list'
} as const

export const PROJECT_URL = 'https://github.com/bouadjadjatamer2-hub/DroidCrate'
export const WEBSITE_URL = 'https://bouadjadjatamer2-hub.github.io/Majra-download-manager-/'
