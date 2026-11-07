import { app, dialog, ipcMain, shell } from "electron";
import { writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { IPC, type AppInfo } from "@shared/api";
import type { AdbActionId, AdbToolName } from "@shared/adb";
import type { DeviceWatcher } from "./device/watcher";
import { loadToolLibrary } from "./tools/library";
import { loadChecklistLibrary } from "./checklists/library";
import type { PlatformToolsService } from "./platformTools/service";
import type { AdbService } from "./adb/service";
import type { ToolkitService } from "./toolkit/service";
import type { LearningService } from "./learning/service";
import type { HistoryService } from "./history/service";
import type { ContentService } from "./content/service";
import { invalidateContentCache } from "./paths";
import type {
  BackupRequest,
  FastbootOemAction,
  FlashRequest,
  PackageAction,
  RebootTarget,
  SideloadRequest,
  ToolkitCommandRequest,
  TransferRequest,
} from "@shared/toolkit";

function isAllowedExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isToolName(value: unknown): value is AdbToolName {
  return value === "adb" || value === "fastboot";
}

export function registerIpc(
  watcher: DeviceWatcher,
  platformTools: PlatformToolsService,
  adb: AdbService,
  toolkit: ToolkitService,
  learning: LearningService,
  history: HistoryService,
  content: ContentService,
): void {
  ipcMain.handle(IPC.appInfo, (): AppInfo => {
    return {
      name: "DroidCrate",
      version: app.getVersion(),
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
      platform: process.platform,
      isPackaged: app.isPackaged,
    };
  });

  ipcMain.handle(
    IPC.openExternal,
    async (_event, url: unknown): Promise<boolean> => {
      if (typeof url !== "string" || !isAllowedExternalUrl(url)) return false;
      await shell.openExternal(url);
      return true;
    },
  );

  ipcMain.handle(IPC.deviceState, () => watcher.getState());

  ipcMain.handle(IPC.deviceRescan, () => watcher.scanNow());

  ipcMain.handle(IPC.toolsList, () => loadToolLibrary());

  ipcMain.handle(IPC.checklistsList, () => loadChecklistLibrary());

  ipcMain.handle(IPC.platformToolsStatus, () => platformTools.getStatus());

  ipcMain.handle(IPC.platformToolsInstall, async () => {
    const startedAt = new Date().toISOString();
    try {
      const status = await platformTools.install();
      history.record({
        category: "platform-tools",
        action: "platform-tools-install",
        command: `Install Platform Tools ${status.version ?? ""}`.trim(),
        serial: null,
        result: "success",
        detail: null,
        startedAt,
      });
      return status;
    } catch (error) {
      history.record({
        category: "platform-tools",
        action: "platform-tools-install",
        command: "Install Platform Tools",
        serial: null,
        result: "failure",
        detail: error instanceof Error ? error.message : String(error),
        startedAt,
      });
      throw error;
    }
  });

  ipcMain.handle(IPC.platformToolsCancel, () => {
    platformTools.cancel();
  });

  ipcMain.handle(IPC.platformToolsRecheck, () =>
    platformTools.detectInstalled(),
  );

  ipcMain.handle(IPC.adbDevices, (_event, tool: unknown) => {
    const selected: AdbToolName = isToolName(tool) ? tool : "adb";
    return adb.listDevices(selected);
  });

  ipcMain.handle(
    IPC.adbRun,
    (_event, action: unknown, serial: unknown, confirmed: unknown) =>
      adb.run(action as AdbActionId, serial, confirmed),
  );

  ipcMain.handle(IPC.adbLog, () => adb.getLog());

  ipcMain.handle(IPC.adbLogClear, () => {
    adb.clearLog();
  });

  ipcMain.handle(IPC.lessonsList, () => learning.getLessonLibrary());

  ipcMain.handle(IPC.learningState, () => learning.getState());

  ipcMain.handle(
    IPC.learningQuiz,
    (_event, lessonId: unknown, answers: unknown) =>
      learning.submitQuiz(lessonId, answers),
  );

  ipcMain.handle(IPC.learningLessonReset, (_event, lessonId: unknown) =>
    learning.resetLesson(lessonId),
  );

  ipcMain.handle(IPC.learningChecklists, () => learning.getChecklists());

  ipcMain.handle(
    IPC.learningChecklistSave,
    async (
      _event,
      checklistId: unknown,
      checked: unknown,
      completedAt: unknown,
    ) => {
      const before =
        typeof checklistId === "string"
          ? (learning.getChecklists()[checklistId]?.completedAt ?? null)
          : null;
      const next = learning.saveChecklist(checklistId, checked, completedAt);
      const after =
        typeof checklistId === "string"
          ? (next[checklistId]?.completedAt ?? null)
          : null;

      if (!before && after) {
        const library = await loadChecklistLibrary();
        const title =
          typeof checklistId === "string"
            ? library.checklists.find(
                (checklist) => checklist.id === checklistId,
              )?.title
            : null;
        history.record({
          category: "checklist",
          action: "checklist-complete",
          command: `Complete checklist: ${title ?? String(checklistId)}`,
          serial: null,
          result: "success",
          detail: null,
          startedAt: after,
        });
      }
      return next;
    },
  );

  ipcMain.handle(IPC.learningChecklistReset, (_event, checklistId: unknown) =>
    learning.resetChecklist(checklistId),
  );

  ipcMain.handle(IPC.learningChecklistImport, (_event, records: unknown) =>
    learning.importChecklists(records),
  );

  ipcMain.handle(IPC.historyList, () => history.list());

  ipcMain.handle(IPC.historyClear, () => {
    history.clear();
  });

  ipcMain.handle(IPC.historyExport, async (_event, format: unknown) => {
    const selected = format === "csv" ? "csv" : "txt";
    const entries = history.list();
    const result = await dialog.showSaveDialog({
      title: "Export operation history",
      defaultPath: join(
        app.getPath("documents"),
        `droidcrate-history.${selected}`,
      ),
      filters:
        selected === "csv"
          ? [{ name: "CSV", extensions: ["csv"] }]
          : [{ name: "Text", extensions: ["txt"] }],
    });

    if (result.canceled || !result.filePath) {
      return { saved: false, path: null, count: entries.length };
    }

    await writeFile(result.filePath, history.exportContent(selected), "utf8");
    return { saved: true, path: result.filePath, count: entries.length };
  });

  ipcMain.handle(IPC.contentStatus, () => content.getStatus());

  ipcMain.handle(IPC.contentCheck, () => content.check());

  ipcMain.handle(IPC.contentApply, async (_event, version: unknown) => {
    if (typeof version !== "string") {
      return {
        installed: false,
        version: null,
        fileCount: 0,
        totalBytes: 0,
        error: "version",
        message: "A content version is required.",
      };
    }
    const result = await content.apply(version);
    if (result.installed) invalidateContentCache();
    return result;
  });

  ipcMain.handle(IPC.contentReset, async () => {
    const status = await content.reset();
    invalidateContentCache();
    return status;
  });

  // ------------------------------------------------------------------ toolkit

  ipcMain.handle(IPC.toolkitCommand, (_event, request: unknown) =>
    toolkit.runCommand(request as ToolkitCommandRequest),
  );

  ipcMain.handle(
    IPC.toolkitPackages,
    (_event, serial: unknown, includeSystem: unknown) =>
      toolkit.listPackages(String(serial ?? ""), includeSystem === true),
  );

  ipcMain.handle(
    IPC.toolkitPackageAction,
    (_event, serial: unknown, packageName: unknown, action: unknown) =>
      toolkit.packageAction(
        String(serial ?? ""),
        String(packageName ?? ""),
        action as PackageAction,
      ),
  );

  ipcMain.handle(
    IPC.toolkitExportApk,
    (_event, serial: unknown, packageName: unknown) =>
      toolkit.exportApk(String(serial ?? ""), String(packageName ?? "")),
  );

  ipcMain.handle(
    IPC.toolkitInstallApk,
    (_event, serial: unknown, apkPath: unknown) =>
      toolkit.installApk(String(serial ?? ""), String(apkPath ?? "")),
  );

  ipcMain.handle(IPC.toolkitScreenshot, (_event, serial: unknown) =>
    toolkit.screenshot(String(serial ?? "")),
  );

  ipcMain.handle(IPC.toolkitLiveFrame, (_event, serial: unknown) =>
    toolkit.liveFrame(String(serial ?? "")),
  );

  ipcMain.handle(IPC.toolkitInput, (_event, serial: unknown, args: unknown) =>
    toolkit.input(
      String(serial ?? ""),
      Array.isArray(args) ? args.map(String) : [],
    ),
  );

  ipcMain.handle(IPC.toolkitRecordStart, (_event, serial: unknown) =>
    toolkit.startRecording(String(serial ?? "")),
  );

  ipcMain.handle(IPC.toolkitRecordStop, () => toolkit.stopRecording());

  ipcMain.handle(IPC.toolkitRecordState, () => toolkit.getRecordingState());

  ipcMain.handle(IPC.toolkitLogcatStart, (_event, serial: unknown) =>
    toolkit.startLogcat(String(serial ?? "")),
  );

  ipcMain.handle(IPC.toolkitLogcatStop, () => toolkit.stopLogcat());

  ipcMain.handle(IPC.toolkitLogcatState, () => toolkit.getLogcatState());

  ipcMain.handle(IPC.toolkitLogcatClear, (_event, serial: unknown) =>
    toolkit.clearLogcat(String(serial ?? "")),
  );

  ipcMain.handle(IPC.toolkitPush, (_event, request: unknown) =>
    toolkit.push(request as TransferRequest),
  );

  ipcMain.handle(IPC.toolkitPull, (_event, request: unknown) =>
    toolkit.pull(request as TransferRequest),
  );

  ipcMain.handle(IPC.toolkitBackup, (_event, request: unknown) =>
    toolkit.backup(request as BackupRequest),
  );

  ipcMain.handle(IPC.toolkitRestore, (_event, request: unknown) =>
    toolkit.restore(request as BackupRequest),
  );

  ipcMain.handle(IPC.toolkitFlash, (_event, request: unknown) =>
    toolkit.flash(request as FlashRequest),
  );

  ipcMain.handle(
    IPC.toolkitErase,
    (_event, serial: unknown, partition: unknown) =>
      toolkit.erase(String(serial ?? ""), String(partition ?? "")),
  );

  ipcMain.handle(IPC.toolkitSideload, (_event, request: unknown) =>
    toolkit.sideload(request as SideloadRequest),
  );

  ipcMain.handle(IPC.toolkitFastbootVars, (_event, serial: unknown) =>
    toolkit.fastbootVars(String(serial ?? "")),
  );

  ipcMain.handle(IPC.toolkitOem, (_event, serial: unknown, action: unknown) =>
    toolkit.oem(String(serial ?? ""), action as FastbootOemAction),
  );

  ipcMain.handle(
    IPC.toolkitReboot,
    (_event, serial: unknown, target: unknown, tool: unknown) =>
      toolkit.reboot(
        String(serial ?? ""),
        target as RebootTarget,
        tool === "fastboot" ? "fastboot" : "adb",
      ),
  );

  ipcMain.handle(IPC.toolkitPickFile, async (_event, kind: unknown) => {
    const filters =
      kind === "apk"
        ? [{ name: "Android app", extensions: ["apk"] }]
        : kind === "image"
          ? [{ name: "Disk image", extensions: ["img", "bin", "raw"] }]
          : kind === "zip"
            ? [{ name: "Update package", extensions: ["zip"] }]
            : [{ name: "All files", extensions: ["*"] }];
    const result = await dialog.showOpenDialog({
      title: "Choose a file",
      properties: ["openFile"],
      filters,
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle(IPC.toolkitPickFolder, async () => {
    const result = await dialog.showOpenDialog({
      title: "Choose a folder",
      properties: ["openDirectory", "createDirectory"],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle(IPC.toolkitReveal, (_event, path: unknown) => {
    if (typeof path !== "string" || !isAbsolute(path)) return false;
    shell.showItemInFolder(path);
    return true;
  });
}
