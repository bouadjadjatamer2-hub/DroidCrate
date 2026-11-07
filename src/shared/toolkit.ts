export type ToolkitTool = "adb" | "fastboot";

export interface ToolkitCommandRequest {
  tool: ToolkitTool;
  serial: string | null;
  args: string[];
  timeoutMs?: number;
}

export interface ToolkitResult {
  ok: boolean;
  tool: ToolkitTool;
  command: string;
  output: string;
  error: string | null;
  exitCode: number | null;
  durationMs: number;
  startedAt: string;
}

export type ToolkitProgressState = "running" | "done" | "failed";

export interface ToolkitProgress {
  id: string;
  label: string;
  /** null means the operation reports no percentage, so the UI shows a busy bar. */
  percent: number | null;
  state: ToolkitProgressState;
  detail: string | null;
}

export interface ToolkitPackage {
  name: string;
  apkPath: string | null;
  system: boolean;
}

export type PackageAction = "uninstall" | "disable" | "enable" | "clear";

export interface PackageActionResult {
  ok: boolean;
  output: string;
  error: string | null;
}

export interface ScreenshotResult {
  path: string;
  dataUrl: string | null;
  width: number | null;
  height: number | null;
  bytes: number;
}

export interface LiveFrame {
  dataUrl: string;
  width: number;
  height: number;
  at: string;
}

export interface RecordingState {
  active: boolean;
  serial: string | null;
  startedAt: string | null;
  /** True when screenrecord stopped on its own (3-minute limit or unplug). */
  ended: boolean;
}

export interface RecordingStopResult {
  path: string | null;
  bytes: number;
  error: string | null;
}

export interface TransferRequest {
  serial: string;
  localPath: string;
  remotePath: string;
}

export interface BackupRequest {
  serial: string;
  folders: string[];
  destination: string;
}

export interface BackupFolderResult {
  folder: string;
  ok: boolean;
  error: string | null;
}

export interface BackupResult {
  ok: boolean;
  destination: string;
  folders: BackupFolderResult[];
}

export interface FlashRequest {
  serial: string;
  partition: string;
  imagePath: string;
}

export interface SideloadRequest {
  serial: string;
  zipPath: string;
}

export type RebootTarget =
  | "system"
  | "bootloader"
  | "recovery"
  | "fastbootd"
  | "sideload"
  | "poweroff";

export type FastbootOemAction = "unlock" | "lock";

export interface LogcatState {
  active: boolean;
  serial: string | null;
  /** The most recent lines, so switching tabs does not lose the stream. */
  lines: string[];
}

export interface LogcatBatch {
  serial: string;
  lines: string[];
  reset: boolean;
}

export interface ToolkitPaths {
  pictures: string;
  documents: string;
}

export const COMMON_PARTITIONS = [
  "boot",
  "recovery",
  "init_boot",
  "vendor_boot",
  "dtbo",
  "vbmeta",
  "vbmeta_system",
  "super",
  "system",
  "vendor",
  "product",
  "userdata",
  "cache",
  "modem",
  "radio",
  "abl",
  "xbl",
  "tz",
] as const;

export const BACKUP_FOLDERS = [
  "DCIM",
  "Pictures",
  "Download",
  "Documents",
  "Movies",
  "Music",
  "WhatsApp",
] as const;

const SERIAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const PACKAGE_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
const PARTITION_PATTERN = /^[a-z0-9_]{1,32}$/;

export function isSafeToolkitSerial(value: string): boolean {
  return SERIAL_PATTERN.test(value);
}

export function isSafePackageName(value: string): boolean {
  return PACKAGE_PATTERN.test(value);
}

export function isSafePartition(value: string): boolean {
  return PARTITION_PATTERN.test(value);
}

/**
 * Remote paths are passed as separate argv entries, never through a shell, but
 * the device side still interprets them. Keep them absolute, short, and free of
 * traversal or control characters.
 */
export function isSafeRemotePath(value: string): boolean {
  if (!value.startsWith("/")) return false;
  if (value.length > 512) return false;
  if (/[\u0000-\u001f]/.test(value)) return false;
  if (value.includes("..")) return false;
  return true;
}

/** Normalises `/sdcard/foo/` to `foo`, rejecting anything outside /sdcard. */
export function toSdcardRelative(value: string): string | null {
  const trimmed = value.replace(/\\/g, "/").replace(/\/+$/, "");
  const prefix = "/sdcard/";
  if (!trimmed.startsWith(prefix)) return null;
  const relative = trimmed.slice(prefix.length);
  if (!relative || relative.includes("..")) return null;
  return relative;
}

/** `pm list packages -f` prints `package:/data/app/x/base.apk=com.example`. */
export function parsePackageList(
  output: string,
  system: boolean,
): ToolkitPackage[] {
  const packages: ToolkitPackage[] = [];
  const seen = new Set<string>();
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("package:")) continue;
    const body = line.slice("package:".length);
    const equals = body.lastIndexOf("=");
    const apkPath = equals === -1 ? null : body.slice(0, equals);
    const name = (equals === -1 ? body : body.slice(equals + 1)).trim();
    if (!isSafePackageName(name) || seen.has(name)) continue;
    seen.add(name);
    packages.push({ name, apkPath, system });
  }
  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

/** Reads `[ 42%] /sdcard/file` lines printed by adb push, pull and sideload. */
export function parseTransferPercent(text: string): number | null {
  const matches = [...text.matchAll(/\[\s*(\d{1,3})%\]/g)];
  if (matches.length === 0) return null;
  const value = Number.parseInt(matches[matches.length - 1][1], 10);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

export function parsePmPath(output: string): string | null {
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("package:")) continue;
    const path = line.slice("package:".length).trim();
    if (path.startsWith("/")) return path;
  }
  return null;
}

/** Fastboot prints `Sending 'boot' (65536 KB)...` then `Writing 'boot'...`. */
export function parseFlashStage(text: string): {
  stage: string;
  percent: number | null;
} {
  if (/Writing '/.test(text)) return { stage: "writing", percent: 90 };
  if (/Sending '/.test(text)) return { stage: "sending", percent: 45 };
  if (/Finished\./.test(text)) return { stage: "finished", percent: 100 };
  return { stage: "flashing", percent: null };
}

export function commandDisplay(
  tool: ToolkitTool,
  args: string[],
  serial: string | null,
): string {
  return [tool, serial ? `-s ${serial}` : null, ...args]
    .filter(Boolean)
    .join(" ");
}
