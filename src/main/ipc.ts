import { app, ipcMain, shell } from 'electron'
import { IPC, type AppInfo } from '@shared/api'
import type { AdbActionId, AdbToolName } from '@shared/adb'
import type { DeviceWatcher } from './device/watcher'
import { loadToolLibrary } from './tools/library'
import { loadChecklistLibrary } from './checklists/library'
import type { PlatformToolsService } from './platformTools/service'
import type { AdbService } from './adb/service'
import type { LearningService } from './learning/service'

function isAllowedExternalUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function isToolName(value: unknown): value is AdbToolName {
  return value === 'adb' || value === 'fastboot'
}

export function registerIpc(
  watcher: DeviceWatcher,
  platformTools: PlatformToolsService,
  adb: AdbService,
  learning: LearningService
): void {
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

  ipcMain.handle(IPC.toolsList, () => loadToolLibrary())

  ipcMain.handle(IPC.checklistsList, () => loadChecklistLibrary())

  ipcMain.handle(IPC.platformToolsStatus, () => platformTools.getStatus())

  ipcMain.handle(IPC.platformToolsInstall, () => platformTools.install())

  ipcMain.handle(IPC.platformToolsCancel, () => {
    platformTools.cancel()
  })

  ipcMain.handle(IPC.platformToolsRecheck, () => platformTools.detectInstalled())

  ipcMain.handle(IPC.adbDevices, (_event, tool: unknown) => {
    const selected: AdbToolName = isToolName(tool) ? tool : 'adb'
    return adb.listDevices(selected)
  })

  ipcMain.handle(
    IPC.adbRun,
    (_event, action: unknown, serial: unknown, confirmed: unknown) =>
      adb.run(action as AdbActionId, serial, confirmed)
  )

  ipcMain.handle(IPC.adbLog, () => adb.getLog())

  ipcMain.handle(IPC.adbLogClear, () => {
    adb.clearLog()
  })

  ipcMain.handle(IPC.lessonsList, () => learning.getLessonLibrary())

  ipcMain.handle(IPC.learningState, () => learning.getState())

  ipcMain.handle(IPC.learningQuiz, (_event, lessonId: unknown, answers: unknown) =>
    learning.submitQuiz(lessonId, answers)
  )

  ipcMain.handle(IPC.learningLessonReset, (_event, lessonId: unknown) =>
    learning.resetLesson(lessonId)
  )

  ipcMain.handle(IPC.learningChecklists, () => learning.getChecklists())

  ipcMain.handle(
    IPC.learningChecklistSave,
    (_event, checklistId: unknown, checked: unknown, completedAt: unknown) =>
      learning.saveChecklist(checklistId, checked, completedAt)
  )

  ipcMain.handle(IPC.learningChecklistReset, (_event, checklistId: unknown) =>
    learning.resetChecklist(checklistId)
  )

  ipcMain.handle(IPC.learningChecklistImport, (_event, records: unknown) =>
    learning.importChecklists(records)
  )
}
