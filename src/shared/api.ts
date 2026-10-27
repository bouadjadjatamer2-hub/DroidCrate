import type { DeviceState } from './device'
import type { ToolLibrary } from './tools'
import type { ChecklistLibrary } from './checklists'
import type { PlatformToolsStatus } from './platformTools'
import type {
  ChecklistProgressMap,
  LearningState,
  LessonLibrary,
  QuizResult
} from './learning'
import type { HistoryEntry, HistoryExportResult } from './history'
import type {
  ContentApplyResult,
  ContentCheckResult,
  ContentStatus
} from './contentUpdate'
import type {
  AdbActionId,
  AdbActionResult,
  AdbDevicesResult,
  AdbLogEntry,
  AdbToolName
} from './adb'

export type SectionId =
  | 'device'
  | 'tools'
  | 'checklists'
  | 'adb'
  | 'lessons'
  | 'history'
  | 'settings'

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
  getPlatformToolsStatus(): Promise<PlatformToolsStatus>
  installPlatformTools(): Promise<PlatformToolsStatus>
  cancelPlatformToolsInstall(): Promise<void>
  recheckPlatformTools(): Promise<PlatformToolsStatus>
  onPlatformToolsUpdate(listener: (status: PlatformToolsStatus) => void): () => void
  listAdbDevices(tool: AdbToolName): Promise<AdbDevicesResult>
  runAdbAction(
    action: AdbActionId,
    serial: string | null,
    confirmed: boolean
  ): Promise<AdbActionResult>
  getAdbLog(): Promise<AdbLogEntry[]>
  clearAdbLog(): Promise<void>
  onAdbLog(listener: (entry: AdbLogEntry) => void): () => void
  getLessonLibrary(): Promise<LessonLibrary>
  getLearningState(): Promise<LearningState>
  submitQuiz(lessonId: string, answers: number[]): Promise<QuizResult>
  resetLessonProgress(lessonId: string): Promise<void>
  getChecklistProgress(): Promise<ChecklistProgressMap>
  saveChecklistProgress(
    checklistId: string,
    checked: string[],
    completedAt: string | null
  ): Promise<ChecklistProgressMap>
  resetChecklistProgress(checklistId: string): Promise<ChecklistProgressMap>
  importChecklistProgress(records: ChecklistProgressMap): Promise<number>
  getHistory(): Promise<HistoryEntry[]>
  clearHistory(): Promise<void>
  exportHistory(format: 'txt' | 'csv'): Promise<HistoryExportResult>
  getContentStatus(): Promise<ContentStatus>
  checkContentUpdate(): Promise<ContentCheckResult>
  applyContentUpdate(version: string): Promise<ContentApplyResult>
  resetContent(): Promise<ContentStatus>
}

export const IPC = {
  appInfo: 'app:info',
  openExternal: 'app:open-external',
  deviceState: 'device:state',
  deviceRescan: 'device:rescan',
  deviceUpdate: 'device:update',
  toolsList: 'tools:list',
  checklistsList: 'checklists:list',
  platformToolsStatus: 'platform-tools:status',
  platformToolsInstall: 'platform-tools:install',
  platformToolsCancel: 'platform-tools:cancel',
  platformToolsRecheck: 'platform-tools:recheck',
  platformToolsUpdate: 'platform-tools:update',
  adbDevices: 'adb:devices',
  adbRun: 'adb:run',
  adbLog: 'adb:log',
  adbLogClear: 'adb:log-clear',
  adbLogUpdate: 'adb:log-update',
  lessonsList: 'lessons:list',
  learningState: 'learning:state',
  learningQuiz: 'learning:quiz',
  learningLessonReset: 'learning:lesson-reset',
  learningChecklists: 'learning:checklists',
  learningChecklistSave: 'learning:checklist-save',
  learningChecklistReset: 'learning:checklist-reset',
  learningChecklistImport: 'learning:checklist-import',
  historyList: 'history:list',
  historyClear: 'history:clear',
  historyExport: 'history:export',
  contentStatus: 'content:status',
  contentCheck: 'content:check',
  contentApply: 'content:apply',
  contentReset: 'content:reset'
} as const

export const PROJECT_URL = 'https://github.com/bouadjadjatamer2-hub/DroidCrate'
export const WEBSITE_URL = 'https://bouadjadjatamer2-hub.github.io/Majra-download-manager-/'
