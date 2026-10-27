import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type AppInfo } from '@shared/api'
import type { DeviceState } from '@shared/device'
import type { ToolLibrary } from '@shared/tools'
import type { ChecklistLibrary } from '@shared/checklists'
import type {
  ChecklistProgressMap,
  LearningState,
  LessonLibrary,
  QuizResult
} from '@shared/learning'
import type { HistoryEntry, HistoryExportResult } from '@shared/history'
import type {
  ContentApplyResult,
  ContentCheckResult,
  ContentStatus
} from '@shared/contentUpdate'
import type { PlatformToolsStatus } from '@shared/platformTools'
import type {
  AdbActionId,
  AdbActionResult,
  AdbDevicesResult,
  AdbLogEntry,
  AdbToolName
} from '@shared/adb'

contextBridge.exposeInMainWorld('droidcrate', {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.appInfo),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke(IPC.openExternal, url),
  getDeviceState: (): Promise<DeviceState> => ipcRenderer.invoke(IPC.deviceState),
  rescanDevices: (): Promise<DeviceState> => ipcRenderer.invoke(IPC.deviceRescan),
  getToolLibrary: (): Promise<ToolLibrary> => ipcRenderer.invoke(IPC.toolsList),
  getChecklistLibrary: (): Promise<ChecklistLibrary> => ipcRenderer.invoke(IPC.checklistsList),
  getPlatformToolsStatus: (): Promise<PlatformToolsStatus> =>
    ipcRenderer.invoke(IPC.platformToolsStatus),
  installPlatformTools: (): Promise<PlatformToolsStatus> =>
    ipcRenderer.invoke(IPC.platformToolsInstall),
  cancelPlatformToolsInstall: (): Promise<void> => ipcRenderer.invoke(IPC.platformToolsCancel),
  recheckPlatformTools: (): Promise<PlatformToolsStatus> =>
    ipcRenderer.invoke(IPC.platformToolsRecheck),
  listAdbDevices: (tool: AdbToolName): Promise<AdbDevicesResult> =>
    ipcRenderer.invoke(IPC.adbDevices, tool),
  runAdbAction: (
    action: AdbActionId,
    serial: string | null,
    confirmed: boolean
  ): Promise<AdbActionResult> => ipcRenderer.invoke(IPC.adbRun, action, serial, confirmed),
  getAdbLog: (): Promise<AdbLogEntry[]> => ipcRenderer.invoke(IPC.adbLog),
  clearAdbLog: (): Promise<void> => ipcRenderer.invoke(IPC.adbLogClear),
  getLessonLibrary: (): Promise<LessonLibrary> => ipcRenderer.invoke(IPC.lessonsList),
  getLearningState: (): Promise<LearningState> => ipcRenderer.invoke(IPC.learningState),
  submitQuiz: (lessonId: string, answers: number[]): Promise<QuizResult> =>
    ipcRenderer.invoke(IPC.learningQuiz, lessonId, answers),
  resetLessonProgress: (lessonId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.learningLessonReset, lessonId),
  getChecklistProgress: (): Promise<ChecklistProgressMap> =>
    ipcRenderer.invoke(IPC.learningChecklists),
  saveChecklistProgress: (
    checklistId: string,
    checked: string[],
    completedAt: string | null
  ): Promise<ChecklistProgressMap> =>
    ipcRenderer.invoke(IPC.learningChecklistSave, checklistId, checked, completedAt),
  resetChecklistProgress: (checklistId: string): Promise<ChecklistProgressMap> =>
    ipcRenderer.invoke(IPC.learningChecklistReset, checklistId),
  importChecklistProgress: (records: ChecklistProgressMap): Promise<number> =>
    ipcRenderer.invoke(IPC.learningChecklistImport, records),
  getHistory: (): Promise<HistoryEntry[]> => ipcRenderer.invoke(IPC.historyList),
  clearHistory: (): Promise<void> => ipcRenderer.invoke(IPC.historyClear),
  exportHistory: (format: 'txt' | 'csv'): Promise<HistoryExportResult> =>
    ipcRenderer.invoke(IPC.historyExport, format),
  getContentStatus: (): Promise<ContentStatus> => ipcRenderer.invoke(IPC.contentStatus),
  checkContentUpdate: (): Promise<ContentCheckResult> => ipcRenderer.invoke(IPC.contentCheck),
  applyContentUpdate: (version: string): Promise<ContentApplyResult> =>
    ipcRenderer.invoke(IPC.contentApply, version),
  resetContent: (): Promise<ContentStatus> => ipcRenderer.invoke(IPC.contentReset),
  onDeviceUpdate: (listener: (state: DeviceState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: DeviceState): void => listener(state)
    ipcRenderer.on(IPC.deviceUpdate, handler)
    return () => ipcRenderer.removeListener(IPC.deviceUpdate, handler)
  },
  onPlatformToolsUpdate: (listener: (status: PlatformToolsStatus) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: PlatformToolsStatus): void =>
      listener(status)
    ipcRenderer.on(IPC.platformToolsUpdate, handler)
    return () => ipcRenderer.removeListener(IPC.platformToolsUpdate, handler)
  },
  onAdbLog: (listener: (entry: AdbLogEntry) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, entry: AdbLogEntry): void => listener(entry)
    ipcRenderer.on(IPC.adbLogUpdate, handler)
    return () => ipcRenderer.removeListener(IPC.adbLogUpdate, handler)
  }
})
