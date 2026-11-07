import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { app, BrowserWindow } from "electron";
import { IPC } from "@shared/api";
import { isSafeSerial } from "@shared/adb";
import type { HistoryInput } from "@shared/history";
import {
  commandDisplay,
  isSafePackageName,
  isSafePartition,
  isSafeRemotePath,
  isSafeToolkitSerial,
  parseFlashStage,
  parsePackageList,
  parsePmPath,
  parseTransferPercent,
  toSdcardRelative,
  type BackupRequest,
  type BackupResult,
  type FastbootOemAction,
  type FlashRequest,
  type LiveFrame,
  type LogcatBatch,
  type LogcatState,
  type PackageAction,
  type PackageActionResult,
  type RecordingState,
  type RecordingStopResult,
  type RebootTarget,
  type ScreenshotResult,
  type SideloadRequest,
  type ToolkitCommandRequest,
  type ToolkitPackage,
  type ToolkitProgress,
  type ToolkitResult,
  type ToolkitTool,
  type TransferRequest,
} from "@shared/toolkit";
import type { PlatformToolsService } from "../platformTools/service";

const MAX_OUTPUT = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 120_000;
const LONG_TIMEOUT_MS = 20 * 60_000;
const MAX_ARGS = 64;
const MAX_ARG_LENGTH = 2048;

interface ProcessOutcome {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  spawnError: string | null;
  durationMs: number;
}

interface BinaryOutcome {
  exitCode: number | null;
  buffer: Buffer;
  stderr: string;
  spawnError: string | null;
}

interface RecordingSession {
  serial: string;
  remotePath: string;
  startedAt: string;
  child: ChildProcess;
}

interface LogcatSession {
  serial: string;
  child: ChildProcess;
  pending: string[];
  buffer: string;
  timer: NodeJS.Timeout;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timestamp(): string {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function pngSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") return null;
  if (buffer.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

export class ToolkitService {
  private recording: RecordingSession | null = null;
  private logcat: LogcatSession | null = null;

  constructor(
    private readonly platformTools: PlatformToolsService,
    private readonly recordHistory?: (entry: HistoryInput) => void,
  ) {}

  // ---------------------------------------------------------------- commands

  async runCommand(input: ToolkitCommandRequest): Promise<ToolkitResult> {
    const startedAt = new Date().toISOString();
    const started = Date.now();
    const tool: ToolkitTool = input.tool === "fastboot" ? "fastboot" : "adb";
    const args = Array.isArray(input.args)
      ? input.args.filter((arg) => typeof arg === "string")
      : [];
    const serial =
      typeof input.serial === "string" && input.serial.length > 0
        ? input.serial
        : null;

    const reject = (error: string): ToolkitResult =>
      this.finish(tool, serial, args, startedAt, started, {
        exitCode: null,
        stdout: "",
        stderr: "",
        timedOut: false,
        spawnError: error,
        durationMs: 0,
      });

    if (args.length === 0) return reject("No arguments were given.");
    if (args.length > MAX_ARGS) return reject("Too many arguments.");
    if (
      args.some((arg) => arg.length > MAX_ARG_LENGTH || arg.includes("\u0000"))
    ) {
      return reject("One of the arguments is not valid.");
    }
    if (serial && !isSafeToolkitSerial(serial))
      return reject("The device serial is not valid.");

    const resolved = this.resolveTool(tool);
    if ("error" in resolved) return reject(resolved.error);

    const timeout = Math.min(
      Math.max(input.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1_000),
      LONG_TIMEOUT_MS,
    );
    const outcome = await this.runProcess(
      resolved.path,
      serial ? ["-s", serial, ...args] : args,
      timeout,
    );
    return this.finish(tool, serial, args, startedAt, started, outcome);
  }

  // ---------------------------------------------------------------- packages

  async listPackages(
    serial: string,
    includeSystem: boolean,
  ): Promise<{
    ok: boolean;
    packages: ToolkitPackage[];
    error: string | null;
  }> {
    const resolved = this.resolveTool("adb");
    if ("error" in resolved)
      return { ok: false, packages: [], error: resolved.error };
    if (!isSafeToolkitSerial(serial))
      return { ok: false, packages: [], error: "Invalid serial." };

    const args = ["-s", serial, "shell", "pm", "list", "packages", "-f"];
    if (!includeSystem) args.push("-3");
    const outcome = await this.runProcess(resolved.path, args, 60_000);
    const output = `${outcome.stdout}\n${outcome.stderr}`;
    if (outcome.spawnError)
      return { ok: false, packages: [], error: outcome.spawnError };
    if (outcome.timedOut)
      return { ok: false, packages: [], error: "The device did not answer." };
    return {
      ok: outcome.exitCode === 0,
      packages: parsePackageList(output, includeSystem),
      error: outcome.exitCode === 0 ? null : this.describeFailure(outcome),
    };
  }

  async packageAction(
    serial: string,
    packageName: string,
    action: PackageAction,
  ): Promise<PackageActionResult> {
    const resolved = this.resolveTool("adb");
    if ("error" in resolved)
      return { ok: false, output: "", error: resolved.error };
    if (!isSafeToolkitSerial(serial) || !isSafePackageName(packageName)) {
      return {
        ok: false,
        output: "",
        error: "Invalid device or package name.",
      };
    }

    const map: Record<PackageAction, string[]> = {
      uninstall: ["shell", "pm", "uninstall", packageName],
      disable: ["shell", "pm", "disable-user", "--user", "0", packageName],
      enable: ["shell", "pm", "enable", packageName],
      clear: ["shell", "pm", "clear", packageName],
    };
    const outcome = await this.runProcess(
      resolved.path,
      ["-s", serial, ...map[action]],
      120_000,
    );
    const output = [outcome.stdout, outcome.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
    const ok = outcome.exitCode === 0 && !/Failure|Error/i.test(output);
    this.record(
      "adb",
      `package-${action}`,
      commandDisplay("adb", map[action], serial),
      serial,
      ok,
      output,
    );
    return { ok, output, error: ok ? null : this.describeFailure(outcome) };
  }

  async exportApk(
    serial: string,
    packageName: string,
  ): Promise<{ ok: boolean; path: string | null; error: string | null }> {
    const resolved = this.resolveTool("adb");
    if ("error" in resolved)
      return { ok: false, path: null, error: resolved.error };
    if (!isSafeToolkitSerial(serial) || !isSafePackageName(packageName)) {
      return {
        ok: false,
        path: null,
        error: "Invalid device or package name.",
      };
    }

    const lookup = await this.runProcess(
      resolved.path,
      ["-s", serial, "shell", "pm", "path", packageName],
      30_000,
    );
    const remote = parsePmPath(lookup.stdout);
    if (!remote) {
      return {
        ok: false,
        path: null,
        error: "This package does not expose an APK path.",
      };
    }

    const directory = join(app.getPath("documents"), "DroidCrate", "exports");
    await mkdir(directory, { recursive: true });
    const local = join(directory, `${packageName}.apk`);
    const id = randomUUID();
    this.emitProgress({
      id,
      label: `Exporting ${packageName}`,
      percent: null,
      state: "running",
      detail: null,
    });
    const pull = await this.runProcess(
      resolved.path,
      ["-s", serial, "pull", remote, local],
      LONG_TIMEOUT_MS,
      (chunk) => this.reportPercent(id, `Exporting ${packageName}`, chunk),
    );
    const ok = pull.exitCode === 0;
    this.emitProgress({
      id,
      label: `Exporting ${packageName}`,
      percent: ok ? 100 : null,
      state: ok ? "done" : "failed",
      detail: ok ? local : this.describeFailure(pull),
    });
    this.record(
      "adb",
      "export-apk",
      commandDisplay("adb", ["pull", remote, local], serial),
      serial,
      ok,
      null,
    );
    return {
      ok,
      path: ok ? local : null,
      error: ok ? null : this.describeFailure(pull),
    };
  }

  async installApk(serial: string, apkPath: string): Promise<ToolkitResult> {
    const startedAt = new Date().toISOString();
    const started = Date.now();
    const resolved = this.resolveTool("adb");
    const reject = (error: string): ToolkitResult => ({
      ok: false,
      tool: "adb",
      command: commandDisplay("adb", ["install", apkPath], serial),
      output: "",
      error,
      exitCode: null,
      durationMs: Date.now() - started,
      startedAt,
    });

    if ("error" in resolved) return reject(resolved.error);
    if (!isSafeToolkitSerial(serial)) return reject("Invalid device serial.");
    const info = await stat(apkPath).catch(() => null);
    if (!info || !info.isFile())
      return reject("The APK file could not be read.");
    if (!apkPath.toLowerCase().endsWith(".apk"))
      return reject("Pick an .apk file.");

    const id = randomUUID();
    const label = `Installing ${basename(apkPath)}`;
    this.emitProgress({
      id,
      label,
      percent: null,
      state: "running",
      detail: null,
    });
    const outcome = await this.runProcess(
      resolved.path,
      ["-s", serial, "install", "-r", apkPath],
      LONG_TIMEOUT_MS,
      (chunk) => {
        const line = chunk.trim().split(/\r?\n/).filter(Boolean).pop();
        if (line)
          this.emitProgress({
            id,
            label,
            percent: null,
            state: "running",
            detail: line.slice(0, 160),
          });
      },
    );
    const ok = outcome.exitCode === 0 && /Success/i.test(outcome.stdout);
    this.emitProgress({
      id,
      label,
      percent: ok ? 100 : null,
      state: ok ? "done" : "failed",
      detail: ok ? null : this.describeFailure(outcome),
    });
    return this.finish(
      "adb",
      serial,
      ["install", "-r", apkPath],
      startedAt,
      started,
      outcome,
    );
  }

  // ------------------------------------------------------------------ screen

  async screenshot(serial: string): Promise<ScreenshotResult> {
    const resolved = this.resolveTool("adb");
    if ("error" in resolved) throw new Error(resolved.error);
    if (!isSafeToolkitSerial(serial)) throw new Error("Invalid device serial.");

    const remote = `/sdcard/droidcrate-${timestamp()}.png`;
    const directory = join(app.getPath("pictures"), "DroidCrate");
    await mkdir(directory, { recursive: true });
    const local = join(directory, `screenshot-${timestamp()}.png`);

    const capture = await this.runProcess(
      resolved.path,
      ["-s", serial, "shell", "screencap", "-p", remote],
      45_000,
    );
    if (capture.exitCode !== 0) throw new Error(this.describeFailure(capture));

    const pull = await this.runProcess(
      resolved.path,
      ["-s", serial, "pull", remote, local],
      60_000,
    );
    void this.runProcess(
      resolved.path,
      ["-s", serial, "shell", "rm", "-f", remote],
      20_000,
    );
    if (pull.exitCode !== 0) throw new Error(this.describeFailure(pull));

    const buffer = await readFile(local);
    const size = pngSize(buffer);
    this.record(
      "adb",
      "screenshot",
      `adb -s ${serial} screencap`,
      serial,
      true,
      null,
    );
    return {
      path: local,
      dataUrl:
        buffer.length <= 12 * 1024 * 1024
          ? `data:image/png;base64,${buffer.toString("base64")}`
          : null,
      width: size?.width ?? null,
      height: size?.height ?? null,
      bytes: buffer.length,
    };
  }

  async liveFrame(serial: string): Promise<LiveFrame> {
    const resolved = this.resolveTool("adb");
    if ("error" in resolved) throw new Error(resolved.error);
    if (!isSafeToolkitSerial(serial)) throw new Error("Invalid device serial.");

    const outcome = await this.runBinary(
      resolved.path,
      ["-s", serial, "exec-out", "screencap", "-p"],
      20_000,
    );
    let buffer = outcome.buffer;
    if (!pngSize(buffer)) {
      // Older Windows adb builds corrupt binary stdout. Fall back to file + pull.
      const remote = `/sdcard/droidcrate-live-${timestamp()}.png`;
      await this.runProcess(
        resolved.path,
        ["-s", serial, "shell", "screencap", "-p", remote],
        20_000,
      );
      const local = join(
        app.getPath("temp"),
        `droidcrate-live-${timestamp()}.png`,
      );
      await this.runProcess(
        resolved.path,
        ["-s", serial, "pull", remote, local],
        30_000,
      );
      void this.runProcess(
        resolved.path,
        ["-s", serial, "shell", "rm", "-f", remote],
        15_000,
      );
      buffer = await readFile(local);
      void unlink(local).catch(() => undefined);
    }

    const size = pngSize(buffer);
    if (!size) throw new Error("The device did not return a readable frame.");
    return {
      dataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
      width: size.width,
      height: size.height,
      at: new Date().toISOString(),
    };
  }

  async input(serial: string, args: string[]): Promise<ToolkitResult> {
    const allowed = /^-?\d{1,5}$/;
    if (
      !args.every(
        (arg) =>
          allowed.test(arg) || /^(tap|swipe|keyevent|text|input)$/.test(arg),
      )
    ) {
      throw new Error("Invalid input command.");
    }
    return this.runCommand({
      tool: "adb",
      serial,
      args: ["shell", "input", ...args],
    });
  }

  getRecordingState(): RecordingState {
    return {
      active: this.recording !== null,
      serial: this.recording?.serial ?? null,
      startedAt: this.recording?.startedAt ?? null,
    };
  }

  async startRecording(serial: string): Promise<RecordingState> {
    const resolved = this.resolveTool("adb");
    if ("error" in resolved) throw new Error(resolved.error);
    if (!isSafeToolkitSerial(serial)) throw new Error("Invalid device serial.");
    if (this.recording) throw new Error("A recording is already running.");

    const remotePath = `/sdcard/droidcrate-rec-${timestamp()}.mp4`;
    const child = spawn(
      resolved.path,
      [
        "-s",
        serial,
        "shell",
        "screenrecord",
        "--bit-rate",
        "8000000",
        "--time-limit",
        "180",
        remotePath,
      ],
      { windowsHide: true },
    );
    child.on("error", () => undefined);
    child.stdout?.resume();
    child.stderr?.resume();
    this.recording = {
      serial,
      remotePath,
      startedAt: new Date().toISOString(),
      child,
    };
    this.record(
      "adb",
      "record-start",
      `adb -s ${serial} screenrecord`,
      serial,
      true,
      null,
    );
    return this.getRecordingState();
  }

  async stopRecording(): Promise<RecordingStopResult> {
    const resolved = this.resolveTool("adb");
    if ("error" in resolved)
      return { path: null, bytes: 0, error: resolved.error };
    const session = this.recording;
    if (!session)
      return { path: null, bytes: 0, error: "No recording is running." };

    await this.runProcess(
      resolved.path,
      ["-s", session.serial, "shell", "pkill", "-2", "screenrecord"],
      15_000,
    );
    await sleep(1_800);
    session.child.kill();
    this.recording = null;

    const directory = join(app.getPath("videos"), "DroidCrate");
    await mkdir(directory, { recursive: true });
    const local = join(directory, `recording-${timestamp()}.mp4`);
    const pull = await this.runProcess(
      resolved.path,
      ["-s", session.serial, "pull", session.remotePath, local],
      LONG_TIMEOUT_MS,
    );
    void this.runProcess(
      resolved.path,
      ["-s", session.serial, "shell", "rm", "-f", session.remotePath],
      20_000,
    );
    if (pull.exitCode !== 0) {
      return { path: null, bytes: 0, error: this.describeFailure(pull) };
    }
    const info = await stat(local).catch(() => null);
    this.record(
      "adb",
      "record-stop",
      `adb -s ${session.serial} pull ${session.remotePath}`,
      session.serial,
      true,
      null,
    );
    return { path: local, bytes: info?.size ?? 0, error: null };
  }

  // ------------------------------------------------------------------ logcat

  getLogcatState(): LogcatState {
    return {
      active: this.logcat !== null,
      serial: this.logcat?.serial ?? null,
    };
  }

  startLogcat(serial: string): LogcatState {
    const resolved = this.resolveTool("adb");
    if ("error" in resolved) throw new Error(resolved.error);
    if (!isSafeToolkitSerial(serial)) throw new Error("Invalid device serial.");
    this.stopLogcat();

    const child = spawn(resolved.path, ["-s", serial, "logcat", "-v", "time"], {
      windowsHide: true,
    });
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    const session: LogcatSession = {
      serial,
      child,
      pending: [],
      buffer: "",
      timer: setInterval(() => this.flushLogcat(), 400),
    };

    const onData = (chunk: string): void => {
      session.buffer += chunk;
      const lines = session.buffer.split(/\r?\n/);
      session.buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        session.pending.push(line);
        if (session.pending.length > 6000)
          session.pending.splice(0, session.pending.length - 6000);
      }
    };

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", () => undefined);
    child.on("close", () => {
      if (this.logcat === session) {
        clearInterval(session.timer);
        this.logcat = null;
      }
    });

    this.logcat = session;
    this.record(
      "adb",
      "logcat-start",
      `adb -s ${serial} logcat`,
      serial,
      true,
      null,
    );
    return this.getLogcatState();
  }

  stopLogcat(): LogcatState {
    const session = this.logcat;
    if (!session) return { active: false, serial: null };
    this.flushLogcat();
    clearInterval(session.timer);
    session.child.kill();
    this.logcat = null;
    return { active: false, serial: null };
  }

  clearLogcat(serial: string): Promise<ToolkitResult> {
    return this.runCommand({
      tool: "adb",
      serial,
      args: ["logcat", "-c"],
      timeoutMs: 20_000,
    });
  }

  private flushLogcat(): void {
    const session = this.logcat;
    if (!session || session.pending.length === 0) return;
    const lines = session.pending.splice(0, session.pending.length);
    this.broadcast(IPC.toolkitLogcat, {
      serial: session.serial,
      lines,
      reset: false,
    } satisfies LogcatBatch);
  }

  // ------------------------------------------------------------------- files

  async push(request: TransferRequest): Promise<ToolkitResult> {
    const startedAt = new Date().toISOString();
    const started = Date.now();
    const resolved = this.resolveTool("adb");
    const reject = (error: string): ToolkitResult => ({
      ok: false,
      tool: "adb",
      command: commandDisplay("adb", ["push"], request.serial),
      output: "",
      error,
      exitCode: null,
      durationMs: 0,
      startedAt,
    });

    if ("error" in resolved) return reject(resolved.error);
    if (!isSafeToolkitSerial(request.serial))
      return reject("Invalid device serial.");
    if (!isSafeRemotePath(request.remotePath))
      return reject('The phone path must start with / and contain no "..".');
    const info = await stat(request.localPath).catch(() => null);
    if (!info) return reject("The local file or folder could not be read.");

    const id = randomUUID();
    const label = `Sending ${basename(request.localPath)}`;
    this.emitProgress({
      id,
      label,
      percent: null,
      state: "running",
      detail: request.remotePath,
    });
    const outcome = await this.runProcess(
      resolved.path,
      ["-s", request.serial, "push", request.localPath, request.remotePath],
      LONG_TIMEOUT_MS,
      (chunk) => this.reportPercent(id, label, chunk),
    );
    const ok = outcome.exitCode === 0;
    this.emitProgress({
      id,
      label,
      percent: ok ? 100 : null,
      state: ok ? "done" : "failed",
      detail: ok ? null : this.describeFailure(outcome),
    });
    return this.finish(
      "adb",
      request.serial,
      ["push", request.localPath, request.remotePath],
      startedAt,
      started,
      outcome,
    );
  }

  async pull(request: TransferRequest): Promise<ToolkitResult> {
    const startedAt = new Date().toISOString();
    const started = Date.now();
    const resolved = this.resolveTool("adb");
    const reject = (error: string): ToolkitResult => ({
      ok: false,
      tool: "adb",
      command: commandDisplay("adb", ["pull"], request.serial),
      output: "",
      error,
      exitCode: null,
      durationMs: 0,
      startedAt,
    });

    if ("error" in resolved) return reject(resolved.error);
    if (!isSafeToolkitSerial(request.serial))
      return reject("Invalid device serial.");
    if (!isSafeRemotePath(request.remotePath))
      return reject('The phone path must start with / and contain no "..".');
    await mkdir(dirname(request.localPath), { recursive: true }).catch(
      () => undefined,
    );

    const id = randomUUID();
    const label = `Bringing ${basename(request.remotePath)}`;
    this.emitProgress({
      id,
      label,
      percent: null,
      state: "running",
      detail: request.localPath,
    });
    const outcome = await this.runProcess(
      resolved.path,
      ["-s", request.serial, "pull", request.remotePath, request.localPath],
      LONG_TIMEOUT_MS,
      (chunk) => this.reportPercent(id, label, chunk),
    );
    const ok = outcome.exitCode === 0;
    this.emitProgress({
      id,
      label,
      percent: ok ? 100 : null,
      state: ok ? "done" : "failed",
      detail: ok ? request.localPath : this.describeFailure(outcome),
    });
    return this.finish(
      "adb",
      request.serial,
      ["pull", request.remotePath, request.localPath],
      startedAt,
      started,
      outcome,
    );
  }

  async backup(request: BackupRequest): Promise<BackupResult> {
    const resolved = this.resolveTool("adb");
    if ("error" in resolved) throw new Error(resolved.error);
    if (!isSafeToolkitSerial(request.serial))
      throw new Error("Invalid device serial.");
    if (request.folders.length === 0)
      throw new Error("Pick at least one folder.");

    await mkdir(request.destination, { recursive: true });
    const folders: BackupResult["folders"] = [];
    const id = randomUUID();
    let index = 0;

    for (const folder of request.folders) {
      const relative = toSdcardRelative(`/sdcard/${folder}`);
      if (!relative) {
        folders.push({ folder, ok: false, error: "Invalid folder name." });
        continue;
      }
      index += 1;
      const base = ((index - 1) / request.folders.length) * 100;
      const span = 100 / request.folders.length;
      const label = `Backing up ${folder}`;
      this.emitProgress({
        id,
        label,
        percent: Math.round(base),
        state: "running",
        detail: null,
      });

      const outcome = await this.runProcess(
        resolved.path,
        [
          "-s",
          request.serial,
          "pull",
          `/sdcard/${relative}`,
          join(request.destination, relative),
        ],
        LONG_TIMEOUT_MS,
        (chunk) => {
          const percent = parseTransferPercent(chunk);
          this.emitProgress({
            id,
            label,
            percent:
              percent === null
                ? null
                : Math.round(base + (percent / 100) * span),
            state: "running",
            detail: null,
          });
        },
      );
      const ok = outcome.exitCode === 0;
      folders.push({
        folder,
        ok,
        error: ok ? null : this.describeFailure(outcome),
      });
      this.record(
        "adb",
        "backup",
        `adb -s ${request.serial} pull /sdcard/${relative}`,
        request.serial,
        ok,
        null,
      );
    }

    const ok = folders.every((entry) => entry.ok);
    this.emitProgress({
      id,
      label: "Backup",
      percent: ok ? 100 : null,
      state: ok ? "done" : "failed",
      detail: ok ? request.destination : null,
    });
    return { ok, destination: request.destination, folders };
  }

  async restore(request: BackupRequest): Promise<BackupResult> {
    const resolved = this.resolveTool("adb");
    if ("error" in resolved) throw new Error(resolved.error);
    if (!isSafeToolkitSerial(request.serial))
      throw new Error("Invalid device serial.");

    const folders: BackupResult["folders"] = [];
    const id = randomUUID();
    let index = 0;
    for (const folder of request.folders) {
      const local = join(request.destination, folder);
      const info = await stat(local).catch(() => null);
      if (!info?.isDirectory()) {
        folders.push({
          folder,
          ok: false,
          error: "This folder is not in the backup.",
        });
        continue;
      }
      index += 1;
      const base = ((index - 1) / request.folders.length) * 100;
      const span = 100 / request.folders.length;
      const label = `Restoring ${folder}`;
      this.emitProgress({
        id,
        label,
        percent: Math.round(base),
        state: "running",
        detail: null,
      });
      const outcome = await this.runProcess(
        resolved.path,
        ["-s", request.serial, "push", local, `/sdcard/${folder}`],
        LONG_TIMEOUT_MS,
        (chunk) => {
          const percent = parseTransferPercent(chunk);
          this.emitProgress({
            id,
            label,
            percent:
              percent === null
                ? null
                : Math.round(base + (percent / 100) * span),
            state: "running",
            detail: null,
          });
        },
      );
      const ok = outcome.exitCode === 0;
      folders.push({
        folder,
        ok,
        error: ok ? null : this.describeFailure(outcome),
      });
      this.record(
        "adb",
        "restore",
        `adb -s ${request.serial} push ${local}`,
        request.serial,
        ok,
        null,
      );
    }
    const ok = folders.every((entry) => entry.ok);
    this.emitProgress({
      id,
      label: "Restore",
      percent: ok ? 100 : null,
      state: ok ? "done" : "failed",
      detail: null,
    });
    return { ok, destination: request.destination, folders };
  }

  // ----------------------------------------------------------------- fastboot

  async flash(request: FlashRequest): Promise<ToolkitResult> {
    const startedAt = new Date().toISOString();
    const started = Date.now();
    const resolved = this.resolveTool("fastboot");
    const reject = (error: string): ToolkitResult => ({
      ok: false,
      tool: "fastboot",
      command: commandDisplay(
        "fastboot",
        ["flash", request.partition],
        request.serial,
      ),
      output: "",
      error,
      exitCode: null,
      durationMs: 0,
      startedAt,
    });

    if ("error" in resolved) return reject(resolved.error);
    if (!isSafeToolkitSerial(request.serial))
      return reject("Invalid device serial.");
    if (!isSafePartition(request.partition))
      return reject("Invalid partition name.");
    const info = await stat(request.imagePath).catch(() => null);
    if (!info?.isFile()) return reject("The image file could not be read.");

    const id = randomUUID();
    const label = `Flashing ${request.partition}`;
    this.emitProgress({
      id,
      label,
      percent: null,
      state: "running",
      detail: basename(request.imagePath),
    });
    const outcome = await this.runProcess(
      resolved.path,
      ["-s", request.serial, "flash", request.partition, request.imagePath],
      LONG_TIMEOUT_MS,
      (chunk) => {
        const parsed = parseFlashStage(chunk);
        this.emitProgress({
          id,
          label,
          percent: parsed.percent,
          state: "running",
          detail: parsed.stage,
        });
      },
    );
    const ok = outcome.exitCode === 0 && /Finished\./.test(outcome.stdout);
    this.emitProgress({
      id,
      label,
      percent: ok ? 100 : null,
      state: ok ? "done" : "failed",
      detail: ok ? null : this.describeFailure(outcome),
    });
    return this.finish(
      "fastboot",
      request.serial,
      ["flash", request.partition, request.imagePath],
      startedAt,
      started,
      outcome,
    );
  }

  async erase(serial: string, partition: string): Promise<ToolkitResult> {
    if (!isSafePartition(partition)) {
      return {
        ok: false,
        tool: "fastboot",
        command: `fastboot erase ${partition}`,
        output: "",
        error: "Invalid partition name.",
        exitCode: null,
        durationMs: 0,
        startedAt: new Date().toISOString(),
      };
    }
    return this.runCommand({
      tool: "fastboot",
      serial,
      args: ["erase", partition],
      timeoutMs: 120_000,
    });
  }

  async sideload(request: SideloadRequest): Promise<ToolkitResult> {
    const startedAt = new Date().toISOString();
    const started = Date.now();
    const resolved = this.resolveTool("adb");
    const reject = (error: string): ToolkitResult => ({
      ok: false,
      tool: "adb",
      command: commandDisplay("adb", ["sideload"], request.serial),
      output: "",
      error,
      exitCode: null,
      durationMs: 0,
      startedAt,
    });

    if ("error" in resolved) return reject(resolved.error);
    if (!isSafeToolkitSerial(request.serial))
      return reject("Invalid device serial.");
    const info = await stat(request.zipPath).catch(() => null);
    if (!info?.isFile()) return reject("The update package could not be read.");

    const id = randomUUID();
    const label = `Sideloading ${basename(request.zipPath)}`;
    this.emitProgress({
      id,
      label,
      percent: null,
      state: "running",
      detail: null,
    });
    const outcome = await this.runProcess(
      resolved.path,
      ["-s", request.serial, "sideload", request.zipPath],
      LONG_TIMEOUT_MS,
      (chunk) => this.reportPercent(id, label, chunk),
    );
    const ok = outcome.exitCode === 0;
    this.emitProgress({
      id,
      label,
      percent: ok ? 100 : null,
      state: ok ? "done" : "failed",
      detail: ok ? null : this.describeFailure(outcome),
    });
    return this.finish(
      "adb",
      request.serial,
      ["sideload", request.zipPath],
      startedAt,
      started,
      outcome,
    );
  }

  async fastbootVars(
    serial: string,
  ): Promise<{ ok: boolean; output: string; error: string | null }> {
    const resolved = this.resolveTool("fastboot");
    if ("error" in resolved)
      return { ok: false, output: "", error: resolved.error };
    if (!isSafeToolkitSerial(serial))
      return { ok: false, output: "", error: "Invalid serial." };
    const outcome = await this.runProcess(
      resolved.path,
      ["-s", serial, "getvar", "all"],
      60_000,
    );
    const output = [outcome.stdout, outcome.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
    const ok = outcome.exitCode === 0;
    return { ok, output, error: ok ? null : this.describeFailure(outcome) };
  }

  async oem(serial: string, action: FastbootOemAction): Promise<ToolkitResult> {
    const resolved = this.resolveTool("fastboot");
    if ("error" in resolved) {
      return {
        ok: false,
        tool: "fastboot",
        command: `fastboot flashing ${action}`,
        output: "",
        error: resolved.error,
        exitCode: null,
        durationMs: 0,
        startedAt: new Date().toISOString(),
      };
    }
    const startedAt = new Date().toISOString();
    const started = Date.now();
    const first = await this.runProcess(
      resolved.path,
      ["-s", serial, "flashing", action],
      90_000,
    );
    if (first.exitCode === 0) {
      return this.finish(
        "fastboot",
        serial,
        ["flashing", action],
        startedAt,
        started,
        first,
      );
    }
    const second = await this.runProcess(
      resolved.path,
      ["-s", serial, "oem", action],
      90_000,
    );
    return this.finish(
      "fastboot",
      serial,
      ["oem", action],
      startedAt,
      started,
      second,
    );
  }

  async reboot(
    serial: string,
    target: RebootTarget,
    tool: ToolkitTool = "adb",
  ): Promise<ToolkitResult> {
    const args =
      target === "system"
        ? ["reboot"]
        : target === "poweroff"
          ? ["reboot", "-p"]
          : target === "sideload"
            ? ["reboot", "sideload"]
            : ["reboot", target];
    return this.runCommand({ tool, serial, args, timeoutMs: 30_000 });
  }

  // ------------------------------------------------------------------ helpers

  private resolveTool(tool: ToolkitTool): { path: string } | { error: string } {
    if (!this.platformTools.getStatus().installed) {
      return {
        error:
          "Platform Tools is not ready yet. Open the Device tab and install it once; after that everything works offline.",
      };
    }
    const path =
      tool === "adb"
        ? this.platformTools.getAdbPath()
        : this.platformTools.getFastbootPath();
    if (!path)
      return {
        error:
          "Platform Tools is missing its adb or fastboot binary. Reinstall it once.",
      };
    return { path };
  }

  private runProcess(
    exe: string,
    args: string[],
    timeoutMs: number,
    onData?: (chunk: string) => void,
  ): Promise<ProcessOutcome> {
    return new Promise((resolve) => {
      const started = Date.now();
      const child = spawn(exe, args, { windowsHide: true });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let spawnError: string | null = null;
      let settled = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);

      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string) => {
        if (stdout.length < MAX_OUTPUT) stdout += chunk;
        onData?.(chunk);
      });
      child.stderr?.on("data", (chunk: string) => {
        if (stderr.length < MAX_OUTPUT) stderr += chunk;
        onData?.(chunk);
      });
      child.on("error", (error) => {
        spawnError = error.message;
      });
      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          exitCode: code,
          stdout,
          stderr,
          timedOut,
          spawnError,
          durationMs: Date.now() - started,
        });
      });
    });
  }

  private runBinary(
    exe: string,
    args: string[],
    timeoutMs: number,
  ): Promise<BinaryOutcome> {
    return new Promise((resolve) => {
      const child = spawn(exe, args, { windowsHide: true });
      const chunks: Buffer[] = [];
      let stderr = "";
      let spawnError: string | null = null;
      const timer = setTimeout(() => child.kill(), timeoutMs);

      child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));
      child.stderr?.setEncoding("utf8");
      child.stderr?.on("data", (chunk: string) => {
        stderr += chunk;
      });
      child.on("error", (error) => {
        spawnError = error.message;
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({
          exitCode: code,
          buffer: Buffer.concat(chunks),
          stderr,
          spawnError,
        });
      });
    });
  }

  private describeFailure(outcome: ProcessOutcome): string {
    if (outcome.timedOut) return "The device did not answer in time.";
    if (outcome.spawnError) return outcome.spawnError;
    const detail = [outcome.stderr, outcome.stdout]
      .map((value) => value.trim())
      .filter(Boolean)
      .join("\n");
    return detail || "The command returned an error.";
  }

  private finish(
    tool: ToolkitTool,
    serial: string | null,
    args: string[],
    startedAt: string,
    started: number,
    outcome: ProcessOutcome,
  ): ToolkitResult {
    const output = [outcome.stdout, outcome.stderr]
      .map((value) => value.trimEnd())
      .filter(Boolean)
      .join("\n")
      .slice(0, MAX_OUTPUT);
    const ok = outcome.exitCode === 0 && !outcome.spawnError;
    const result: ToolkitResult = {
      ok,
      tool,
      command: commandDisplay(tool, args, serial),
      output,
      error: ok ? null : this.describeFailure(outcome),
      exitCode: outcome.exitCode,
      durationMs: outcome.durationMs || Date.now() - started,
      startedAt,
    };
    this.record(tool, "command", result.command, serial, ok, result.error);
    return result;
  }

  private record(
    category: "adb" | "fastboot",
    action: string,
    command: string,
    serial: string | null,
    ok: boolean,
    detail: string | null,
  ): void {
    this.recordHistory?.({
      category,
      action,
      command,
      serial: serial && isSafeSerial(serial) ? serial : null,
      result: ok ? "success" : "failure",
      detail,
      startedAt: new Date().toISOString(),
    });
  }

  private emitProgress(progress: ToolkitProgress): void {
    this.broadcast(IPC.toolkitProgress, progress);
  }

  private reportPercent(id: string, label: string, chunk: string): void {
    const percent = parseTransferPercent(chunk);
    if (percent === null) return;
    this.emitProgress({ id, label, percent, state: "running", detail: null });
  }

  private broadcast(channel: string, payload: unknown): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(channel, payload);
    }
  }
}
