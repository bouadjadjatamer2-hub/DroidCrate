import { app, dialog, ipcMain, shell } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { IPC, type AppInfo } from '@shared/api'
import type { AdbActionId, AdbToolName } from '@shared/adb'
import type { DeviceWatcher } from './device/watcher'
import { loadToolLibrary } from './tools/library'
import { loadChecklistLibrary } from './checklists/library'
import type { PlatformToolsService } from './platformTools/service'
import type { AdbService } from './adb/service'
import type { LearningService } from './learning/service'
import type { HistoryService } from './history/service'

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
  learning: LearningService,
  history: HistoryService
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

  ipcMain.handle(IPC.platformToolsInstall, async () => {
    const startedAt = new Date().toISOString()
    try {
      const status = await platformTools.install()
      history.record({
        category: 'platform-tools',
        action: 'platform-tools-install',
        command: `Install Platform Tools ${status.version ?? ''}`.trim(),
        serial: null,
        result: 'success',
        detail: null,
        startedAt
      })
      return status
    } catch (error) {
      history.record({
        category: 'platform-tools',
        action: 'platform-tools-install',
        command: 'Install Platform Tools',
        serial: null,
        result: 'failure',
        detail: error instanceof Error ? error.message : String(error),
        startedAt
      })
      throw error
    }
  })

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
    async (_event, checklistId: unknown, checked: unknown, completedAt: unknown) => {
      const before =
        typeof checklistId === 'string'
          ? learning.getChecklists()[checklistId]?.completedAt ?? null
          : null
      const next = learning.saveChecklist(checklistId, checked, completedAt)
      const after =
        typeof checklistId === 'string' ? next[checklistId]?.completedAt ?? null : null

      if (!before && after) {
        const library = await loadChecklistLibrary()
        const title =
          typeof checklistId === 'string'
            ? library.checklists.find((checklist) => checklist.id === checklistId)?.title
            : null
        history.record({
          category: 'checklist',
          action: 'checklist-complete',
          command: `Complete checklist: ${title ?? String(checklistId)}`,
          serial: null,
          result: 'success',
          detail: null,
          startedAt: after
        })
      }
      return next
    }
  )

  ipcMain.handle(IPC.learningChecklistReset, (_event, checklistId: unknown) =>
    learning.resetChecklist(checklistId)
  )

  ipcMain.handle(IPC.learningChecklistImport, (_event, records: unknown) =>
    learning.importChecklists(records)
  )

  ipcMain.handle(IPC.historyList, () => history.list())

  ipcMain.handle(IPC.historyClear, () => {
    history.clear()
  })

  ipcMain.handle(IPC.historyExport, async (_event, format: unknown) => {
    const selected = format === 'csv' ? 'csv' : 'txt'
    const entries = history.list()
    const result = await dialog.showSaveDialog({
      title: 'Export operation history',
      defaultPath: join(app.getPath('documents'), `droidcrate-history.${selected}`),
      filters:
        selected === 'csv'
          ? [{ name: 'CSV', extensions: ['csv'] }]
          : [{ name: 'Text', extensions: ['txt'] }]
    })

    if (result.canceled || !result.filePath) {
      return { saved: false, path: null, count: entries.length }
    }

    await writeFile(result.filePath, history.exportContent(selected), 'utf8')
    return { saved: true, path: result.filePath, count: entries.length }
  })
}
