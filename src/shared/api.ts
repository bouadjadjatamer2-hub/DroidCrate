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
}

export const IPC = {
  appInfo: 'app:info',
  openExternal: 'app:open-external'
} as const

export const PROJECT_URL = 'https://github.com/bouadjadjatamer2-hub/DroidCrate'
export const WEBSITE_URL = 'https://bouadjadjatamer2-hub.github.io/Majra-download-manager-/'
