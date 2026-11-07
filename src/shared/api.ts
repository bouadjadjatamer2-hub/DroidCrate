import type { DeviceState } from "./device";
import type { ToolLibrary } from "./tools";
import type { ChecklistLibrary } from "./checklists";
import type { PlatformToolsStatus } from "./platformTools";
import type {
  ChecklistProgressMap,
  LearningState,
  LessonLibrary,
  QuizResult,
} from "./learning";
import type { HistoryEntry, HistoryExportResult } from "./history";
import type {
  ContentApplyResult,
  ContentCheckResult,
  ContentStatus,
} from "./contentUpdate";
import type {
  AdbActionId,
  AdbActionResult,
  AdbDevicesResult,
  AdbLogEntry,
  AdbToolName,
} from "./adb";
import type {
  BackupRequest,
  BackupResult,
  FastbootOemAction,
  FlashRequest,
  LiveFrame,
  LogcatBatch,
  LogcatState,
  PackageAction,
  PackageActionResult,
  RecordingState,
  RecordingStopResult,
  RebootTarget,
  ScreenshotResult,
  SideloadRequest,
  ToolkitCommandRequest,
  ToolkitPackage,
  ToolkitProgress,
  ToolkitResult,
  ToolkitTool,
  TransferRequest,
} from "./toolkit";

export type SectionId =
  | "device"
  | "tools"
  | "checklists"
  | "adb"
  | "lessons"
  | "history"
  | "settings";

export interface AppInfo {
  name: string;
  version: string;
  electron: string;
  node: string;
  chrome: string;
  platform: string;
  isPackaged: boolean;
}

export interface DroidCrateApi {
  getAppInfo(): Promise<AppInfo>;
  openExternal(url: string): Promise<boolean>;
  getDeviceState(): Promise<DeviceState>;
  rescanDevices(): Promise<DeviceState>;
  onDeviceUpdate(listener: (state: DeviceState) => void): () => void;
  getToolLibrary(): Promise<ToolLibrary>;
  getChecklistLibrary(): Promise<ChecklistLibrary>;
  getPlatformToolsStatus(): Promise<PlatformToolsStatus>;
  installPlatformTools(): Promise<PlatformToolsStatus>;
  cancelPlatformToolsInstall(): Promise<void>;
  recheckPlatformTools(): Promise<PlatformToolsStatus>;
  onPlatformToolsUpdate(
    listener: (status: PlatformToolsStatus) => void,
  ): () => void;
  listAdbDevices(tool: AdbToolName): Promise<AdbDevicesResult>;
  runAdbAction(
    action: AdbActionId,
    serial: string | null,
    confirmed: boolean,
  ): Promise<AdbActionResult>;
  getAdbLog(): Promise<AdbLogEntry[]>;
  clearAdbLog(): Promise<void>;
  onAdbLog(listener: (entry: AdbLogEntry) => void): () => void;
  getLessonLibrary(): Promise<LessonLibrary>;
  getLearningState(): Promise<LearningState>;
  submitQuiz(lessonId: string, answers: number[]): Promise<QuizResult>;
  resetLessonProgress(lessonId: string): Promise<void>;
  getChecklistProgress(): Promise<ChecklistProgressMap>;
  saveChecklistProgress(
    checklistId: string,
    checked: string[],
    completedAt: string | null,
  ): Promise<ChecklistProgressMap>;
  resetChecklistProgress(checklistId: string): Promise<ChecklistProgressMap>;
  importChecklistProgress(records: ChecklistProgressMap): Promise<number>;
  getHistory(): Promise<HistoryEntry[]>;
  clearHistory(): Promise<void>;
  exportHistory(format: "txt" | "csv"): Promise<HistoryExportResult>;
  getContentStatus(): Promise<ContentStatus>;
  checkContentUpdate(): Promise<ContentCheckResult>;
  applyContentUpdate(version: string): Promise<ContentApplyResult>;
  resetContent(): Promise<ContentStatus>;

  // Toolkit: everything runs inside the app, on the bundled adb/fastboot.
  runToolkitCommand(request: ToolkitCommandRequest): Promise<ToolkitResult>;
  listPackages(
    serial: string,
    includeSystem: boolean,
  ): Promise<{
    ok: boolean;
    packages: ToolkitPackage[];
    error: string | null;
  }>;
  packageAction(
    serial: string,
    packageName: string,
    action: PackageAction,
  ): Promise<PackageActionResult>;
  exportApk(
    serial: string,
    packageName: string,
  ): Promise<{ ok: boolean; path: string | null; error: string | null }>;
  installApk(serial: string, apkPath: string): Promise<ToolkitResult>;
  takeScreenshot(serial: string): Promise<ScreenshotResult>;
  getLiveFrame(serial: string): Promise<LiveFrame>;
  sendInput(serial: string, args: string[]): Promise<ToolkitResult>;
  startRecording(serial: string): Promise<RecordingState>;
  stopRecording(): Promise<RecordingStopResult>;
  getRecordingState(): Promise<RecordingState>;
  startLogcat(serial: string): Promise<LogcatState>;
  stopLogcat(): Promise<LogcatState>;
  getLogcatState(): Promise<LogcatState>;
  clearLogcat(serial: string): Promise<ToolkitResult>;
  pushFile(request: TransferRequest): Promise<ToolkitResult>;
  pullFile(request: TransferRequest): Promise<ToolkitResult>;
  backupDevice(request: BackupRequest): Promise<BackupResult>;
  restoreDevice(request: BackupRequest): Promise<BackupResult>;
  flashPartition(request: FlashRequest): Promise<ToolkitResult>;
  erasePartition(serial: string, partition: string): Promise<ToolkitResult>;
  sideloadPackage(request: SideloadRequest): Promise<ToolkitResult>;
  getFastbootVars(
    serial: string,
  ): Promise<{ ok: boolean; output: string; error: string | null }>;
  fastbootOem(
    serial: string,
    action: FastbootOemAction,
  ): Promise<ToolkitResult>;
  rebootDevice(
    serial: string,
    target: RebootTarget,
    tool: ToolkitTool,
  ): Promise<ToolkitResult>;
  pickFile(kind: "apk" | "image" | "zip" | "any"): Promise<string | null>;
  pickFolder(): Promise<string | null>;
  revealPath(path: string): Promise<boolean>;
  pathForFile(file: unknown): string;
  onToolkitProgress(listener: (progress: ToolkitProgress) => void): () => void;
  onLogcat(listener: (batch: LogcatBatch) => void): () => void;
}

export const IPC = {
  appInfo: "app:info",
  openExternal: "app:open-external",
  deviceState: "device:state",
  deviceRescan: "device:rescan",
  deviceUpdate: "device:update",
  toolsList: "tools:list",
  checklistsList: "checklists:list",
  platformToolsStatus: "platform-tools:status",
  platformToolsInstall: "platform-tools:install",
  platformToolsCancel: "platform-tools:cancel",
  platformToolsRecheck: "platform-tools:recheck",
  platformToolsUpdate: "platform-tools:update",
  adbDevices: "adb:devices",
  adbRun: "adb:run",
  adbLog: "adb:log",
  adbLogClear: "adb:log-clear",
  adbLogUpdate: "adb:log-update",
  lessonsList: "lessons:list",
  learningState: "learning:state",
  learningQuiz: "learning:quiz",
  learningLessonReset: "learning:lesson-reset",
  learningChecklists: "learning:checklists",
  learningChecklistSave: "learning:checklist-save",
  learningChecklistReset: "learning:checklist-reset",
  learningChecklistImport: "learning:checklist-import",
  historyList: "history:list",
  historyClear: "history:clear",
  historyExport: "history:export",
  contentStatus: "content:status",
  contentCheck: "content:check",
  contentApply: "content:apply",
  contentReset: "content:reset",
  toolkitCommand: "toolkit:command",
  toolkitPackages: "toolkit:packages",
  toolkitPackageAction: "toolkit:package-action",
  toolkitExportApk: "toolkit:export-apk",
  toolkitInstallApk: "toolkit:install-apk",
  toolkitScreenshot: "toolkit:screenshot",
  toolkitLiveFrame: "toolkit:live-frame",
  toolkitInput: "toolkit:input",
  toolkitRecordStart: "toolkit:record-start",
  toolkitRecordStop: "toolkit:record-stop",
  toolkitRecordState: "toolkit:record-state",
  toolkitLogcatStart: "toolkit:logcat-start",
  toolkitLogcatStop: "toolkit:logcat-stop",
  toolkitLogcatState: "toolkit:logcat-state",
  toolkitLogcatClear: "toolkit:logcat-clear",
  toolkitPush: "toolkit:push",
  toolkitPull: "toolkit:pull",
  toolkitBackup: "toolkit:backup",
  toolkitRestore: "toolkit:restore",
  toolkitFlash: "toolkit:flash",
  toolkitErase: "toolkit:erase",
  toolkitSideload: "toolkit:sideload",
  toolkitFastbootVars: "toolkit:fastboot-vars",
  toolkitOem: "toolkit:oem",
  toolkitReboot: "toolkit:reboot",
  toolkitPickFile: "toolkit:pick-file",
  toolkitPickFolder: "toolkit:pick-folder",
  toolkitReveal: "toolkit:reveal",
  toolkitProgress: "toolkit:progress",
  toolkitLogcat: "toolkit:logcat",
} as const;

export const PROJECT_URL = "https://github.com/bouadjadjatamer2-hub/DroidCrate";
