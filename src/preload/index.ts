import { contextBridge, ipcRenderer, webUtils } from "electron";
import { IPC, type AppInfo } from "@shared/api";
import type { DeviceState } from "@shared/device";
import type { ToolLibrary } from "@shared/tools";
import type { ChecklistLibrary } from "@shared/checklists";
import type {
  ChecklistProgressMap,
  LearningState,
  LessonLibrary,
  QuizResult,
} from "@shared/learning";
import type { HistoryEntry, HistoryExportResult } from "@shared/history";
import type {
  ContentApplyResult,
  ContentCheckResult,
  ContentStatus,
} from "@shared/contentUpdate";
import type { PlatformToolsStatus } from "@shared/platformTools";
import type {
  AdbActionId,
  AdbActionResult,
  AdbDevicesResult,
  AdbLogEntry,
  AdbToolName,
} from "@shared/adb";
import type {
  BackupRequest,
  FastbootOemAction,
  FlashRequest,
  LogcatBatch,
  PackageAction,
  RebootTarget,
  SideloadRequest,
  ToolkitCommandRequest,
  ToolkitProgress,
  ToolkitTool,
  TransferRequest,
} from "@shared/toolkit";

contextBridge.exposeInMainWorld("droidcrate", {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.appInfo),
  openExternal: (url: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.openExternal, url),
  getDeviceState: (): Promise<DeviceState> =>
    ipcRenderer.invoke(IPC.deviceState),
  rescanDevices: (): Promise<DeviceState> =>
    ipcRenderer.invoke(IPC.deviceRescan),
  getToolLibrary: (): Promise<ToolLibrary> => ipcRenderer.invoke(IPC.toolsList),
  getChecklistLibrary: (): Promise<ChecklistLibrary> =>
    ipcRenderer.invoke(IPC.checklistsList),
  getPlatformToolsStatus: (): Promise<PlatformToolsStatus> =>
    ipcRenderer.invoke(IPC.platformToolsStatus),
  installPlatformTools: (): Promise<PlatformToolsStatus> =>
    ipcRenderer.invoke(IPC.platformToolsInstall),
  cancelPlatformToolsInstall: (): Promise<void> =>
    ipcRenderer.invoke(IPC.platformToolsCancel),
  recheckPlatformTools: (): Promise<PlatformToolsStatus> =>
    ipcRenderer.invoke(IPC.platformToolsRecheck),
  listAdbDevices: (tool: AdbToolName): Promise<AdbDevicesResult> =>
    ipcRenderer.invoke(IPC.adbDevices, tool),
  runAdbAction: (
    action: AdbActionId,
    serial: string | null,
    confirmed: boolean,
  ): Promise<AdbActionResult> =>
    ipcRenderer.invoke(IPC.adbRun, action, serial, confirmed),
  getAdbLog: (): Promise<AdbLogEntry[]> => ipcRenderer.invoke(IPC.adbLog),
  clearAdbLog: (): Promise<void> => ipcRenderer.invoke(IPC.adbLogClear),
  getLessonLibrary: (): Promise<LessonLibrary> =>
    ipcRenderer.invoke(IPC.lessonsList),
  getLearningState: (): Promise<LearningState> =>
    ipcRenderer.invoke(IPC.learningState),
  submitQuiz: (lessonId: string, answers: number[]): Promise<QuizResult> =>
    ipcRenderer.invoke(IPC.learningQuiz, lessonId, answers),
  resetLessonProgress: (lessonId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.learningLessonReset, lessonId),
  getChecklistProgress: (): Promise<ChecklistProgressMap> =>
    ipcRenderer.invoke(IPC.learningChecklists),
  saveChecklistProgress: (
    checklistId: string,
    checked: string[],
    completedAt: string | null,
  ): Promise<ChecklistProgressMap> =>
    ipcRenderer.invoke(
      IPC.learningChecklistSave,
      checklistId,
      checked,
      completedAt,
    ),
  resetChecklistProgress: (
    checklistId: string,
  ): Promise<ChecklistProgressMap> =>
    ipcRenderer.invoke(IPC.learningChecklistReset, checklistId),
  importChecklistProgress: (records: ChecklistProgressMap): Promise<number> =>
    ipcRenderer.invoke(IPC.learningChecklistImport, records),
  getHistory: (): Promise<HistoryEntry[]> =>
    ipcRenderer.invoke(IPC.historyList),
  clearHistory: (): Promise<void> => ipcRenderer.invoke(IPC.historyClear),
  exportHistory: (format: "txt" | "csv"): Promise<HistoryExportResult> =>
    ipcRenderer.invoke(IPC.historyExport, format),
  getContentStatus: (): Promise<ContentStatus> =>
    ipcRenderer.invoke(IPC.contentStatus),
  checkContentUpdate: (): Promise<ContentCheckResult> =>
    ipcRenderer.invoke(IPC.contentCheck),
  applyContentUpdate: (version: string): Promise<ContentApplyResult> =>
    ipcRenderer.invoke(IPC.contentApply, version),
  resetContent: (): Promise<ContentStatus> =>
    ipcRenderer.invoke(IPC.contentReset),

  runToolkitCommand: (request: ToolkitCommandRequest) =>
    ipcRenderer.invoke(IPC.toolkitCommand, request),
  listPackages: (serial: string, includeSystem: boolean) =>
    ipcRenderer.invoke(IPC.toolkitPackages, serial, includeSystem),
  packageAction: (serial: string, packageName: string, action: PackageAction) =>
    ipcRenderer.invoke(IPC.toolkitPackageAction, serial, packageName, action),
  exportApk: (serial: string, packageName: string) =>
    ipcRenderer.invoke(IPC.toolkitExportApk, serial, packageName),
  installApk: (serial: string, apkPath: string) =>
    ipcRenderer.invoke(IPC.toolkitInstallApk, serial, apkPath),
  takeScreenshot: (serial: string) =>
    ipcRenderer.invoke(IPC.toolkitScreenshot, serial),
  getLiveFrame: (serial: string) =>
    ipcRenderer.invoke(IPC.toolkitLiveFrame, serial),
  sendInput: (serial: string, args: string[]) =>
    ipcRenderer.invoke(IPC.toolkitInput, serial, args),
  startRecording: (serial: string) =>
    ipcRenderer.invoke(IPC.toolkitRecordStart, serial),
  stopRecording: () => ipcRenderer.invoke(IPC.toolkitRecordStop),
  getRecordingState: () => ipcRenderer.invoke(IPC.toolkitRecordState),
  startLogcat: (serial: string) =>
    ipcRenderer.invoke(IPC.toolkitLogcatStart, serial),
  stopLogcat: () => ipcRenderer.invoke(IPC.toolkitLogcatStop),
  getLogcatState: () => ipcRenderer.invoke(IPC.toolkitLogcatState),
  clearLogcat: (serial: string) =>
    ipcRenderer.invoke(IPC.toolkitLogcatClear, serial),
  pushFile: (request: TransferRequest) =>
    ipcRenderer.invoke(IPC.toolkitPush, request),
  pullFile: (request: TransferRequest) =>
    ipcRenderer.invoke(IPC.toolkitPull, request),
  backupDevice: (request: BackupRequest) =>
    ipcRenderer.invoke(IPC.toolkitBackup, request),
  restoreDevice: (request: BackupRequest) =>
    ipcRenderer.invoke(IPC.toolkitRestore, request),
  flashPartition: (request: FlashRequest) =>
    ipcRenderer.invoke(IPC.toolkitFlash, request),
  erasePartition: (serial: string, partition: string) =>
    ipcRenderer.invoke(IPC.toolkitErase, serial, partition),
  sideloadPackage: (request: SideloadRequest) =>
    ipcRenderer.invoke(IPC.toolkitSideload, request),
  getFastbootVars: (serial: string) =>
    ipcRenderer.invoke(IPC.toolkitFastbootVars, serial),
  fastbootOem: (serial: string, action: FastbootOemAction) =>
    ipcRenderer.invoke(IPC.toolkitOem, serial, action),
  rebootDevice: (serial: string, target: RebootTarget, tool: ToolkitTool) =>
    ipcRenderer.invoke(IPC.toolkitReboot, serial, target, tool),
  pickFile: (kind: "apk" | "image" | "zip" | "any") =>
    ipcRenderer.invoke(IPC.toolkitPickFile, kind),
  pickFolder: () => ipcRenderer.invoke(IPC.toolkitPickFolder),
  revealPath: (path: string) => ipcRenderer.invoke(IPC.toolkitReveal, path),
  pathForFile: (file: unknown): string =>
    webUtils.getPathForFile(
      file as Parameters<typeof webUtils.getPathForFile>[0],
    ),

  onToolkitProgress: (
    listener: (progress: ToolkitProgress) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: ToolkitProgress,
    ): void => listener(progress);
    ipcRenderer.on(IPC.toolkitProgress, handler);
    return () => ipcRenderer.removeListener(IPC.toolkitProgress, handler);
  },
  onLogcat: (listener: (batch: LogcatBatch) => void): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      batch: LogcatBatch,
    ): void => listener(batch);
    ipcRenderer.on(IPC.toolkitLogcat, handler);
    return () => ipcRenderer.removeListener(IPC.toolkitLogcat, handler);
  },
  onDeviceUpdate: (listener: (state: DeviceState) => void): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      state: DeviceState,
    ): void => listener(state);
    ipcRenderer.on(IPC.deviceUpdate, handler);
    return () => ipcRenderer.removeListener(IPC.deviceUpdate, handler);
  },
  onPlatformToolsUpdate: (
    listener: (status: PlatformToolsStatus) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      status: PlatformToolsStatus,
    ): void => listener(status);
    ipcRenderer.on(IPC.platformToolsUpdate, handler);
    return () => ipcRenderer.removeListener(IPC.platformToolsUpdate, handler);
  },
  onAdbLog: (listener: (entry: AdbLogEntry) => void): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      entry: AdbLogEntry,
    ): void => listener(entry);
    ipcRenderer.on(IPC.adbLogUpdate, handler);
    return () => ipcRenderer.removeListener(IPC.adbLogUpdate, handler);
  },
});
