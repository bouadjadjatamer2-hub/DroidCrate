import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { BrowserWindow } from 'electron'
import { IPC } from '@shared/api'
import {
  ADB_ACTIONS,
  isSafeSerial,
  parseAdbDevices,
  parseFastbootDevices,
  type AdbActionId,
  type AdbActionResult,
  type AdbDevicesResult,
  type AdbErrorCode,
  type AdbLogEntry,
  type AdbToolName
} from '@shared/adb'
import type { PlatformToolsService } from '../platformTools/service'
import type { HistoryInput } from '@shared/history'

const MAX_LOG_ENTRIES = 100
const OUTPUT_LIMIT = 512 * 1024
const COMMAND_TIMEOUT_MS = 25_000

interface ProcessResult {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  spawnError: string | null
}

interface RunContext {
  ok: boolean
  output: string
  error: string | null
  errorCode: AdbErrorCode | null
  exitCode: number | null
  durationMs: number
}

function execute(exe: string, args: string[], timeout = COMMAND_TIMEOUT_MS): Promise<ProcessResult> {
  return new Promise((resolve) => {
    execFile(
      exe,
      args,
      {
        timeout,
        windowsHide: true,
        maxBuffer: OUTPUT_LIMIT,
        encoding: 'utf8'
      },
      (error, stdout, stderr) => {
        const failure = error as (NodeJS.ErrnoException & { killed?: boolean }) | null
        resolve({
          exitCode:
            failure && typeof failure.code === 'number'
              ? failure.code
              : failure
                ? null
                : 0,
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          timedOut: failure?.killed === true,
          spawnError: failure && typeof failure.code === 'string' ? failure.message : null
        })
      }
    )
  })
}

function displayCommand(tool: AdbToolName, args: string[], serial: string | null): string {
  const prefix = serial ? `${tool} -s ${serial}` : tool
  return [prefix, ...args].join(' ')
}

function truncate(text: string): string {
  if (text.length <= OUTPUT_LIMIT) return text
  return `${text.slice(0, OUTPUT_LIMIT)}\n[output truncated at ${OUTPUT_LIMIT} characters]`
}

function failureMessage(result: ProcessResult, fallback: string): string {
  const detail = result.stderr.trim() || result.stdout.trim()
  if (result.timedOut) return 'The command timed out. The device did not answer in time.'
  if (result.spawnError) return result.spawnError
  if (detail) return detail
  return fallback
}

export class AdbService {
  private log: AdbLogEntry[] = []

  constructor(
    private readonly platformTools: PlatformToolsService,
    private readonly recordHistory?: (entry: HistoryInput) => void
  ) {}

  getLog(): AdbLogEntry[] {
    return [...this.log].reverse()
  }

  clearLog(): void {
    this.log = []
  }

  async listDevices(tool: AdbToolName): Promise<AdbDevicesResult> {
    const resolved = this.resolveTool(tool)
    if ('error' in resolved) {
      return {
        ok: false,
        devices: [],
        output: '',
        error: resolved.error,
        errorCode: 'not-installed'
      }
    }

    const result = await execute(resolved.path, tool === 'adb' ? ['devices', '-l'] : ['devices'])
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    if (result.timedOut) {
      return {
        ok: false,
        devices: [],
        output,
        error: 'The device list request timed out.',
        errorCode: 'timeout'
      }
    }
    if (result.spawnError) {
      return {
        ok: false,
        devices: [],
        output,
        error: result.spawnError,
        errorCode: 'spawn-failed'
      }
    }

    const devices = tool === 'adb' ? parseAdbDevices(output) : parseFastbootDevices(output)
    return {
      ok: true,
      devices,
      output,
      error: result.exitCode === 0 ? null : failureMessage(result, `${tool} returned an error.`),
      errorCode: result.exitCode === 0 ? null : 'failed'
    }
  }

  async run(
    actionId: unknown,
    serialInput: unknown,
    confirmed: unknown
  ): Promise<AdbActionResult> {
    const startedAt = new Date().toISOString()
    const started = Date.now()

    if (typeof actionId !== 'string' || !(actionId in ADB_ACTIONS)) {
      return this.finish(
        'adb-version',
        'adb',
        'adb',
        startedAt,
        started,
        {
          ok: false,
          output: '',
          error: 'Unknown command. Only commands listed by DroidCrate can run.',
          errorCode: 'invalid-action',
          exitCode: null,
          durationMs: 0
        },
        false
      )
    }

    const action = ADB_ACTIONS[actionId as AdbActionId]
    const serial = typeof serialInput === 'string' && serialInput.length > 0 ? serialInput : null
    const command =
      action.id === 'fastboot-info'
        ? displayCommand(
            action.tool,
            ['getvar', 'product / unlocked / current-slot / slot-count'],
            serial
          )
        : displayCommand(action.tool, action.args, action.requiresSerial ? serial : null)

    const reject = (error: string, errorCode: AdbErrorCode): AdbActionResult =>
      this.finish(action.id, action.tool, command, startedAt, started, {
        ok: false,
        output: '',
        error,
        errorCode,
        exitCode: null,
        durationMs: 0
      })

    if (action.requiresSerial) {
      if (!serial || !isSafeSerial(serial)) {
        return reject('Select a valid connected device first.', 'invalid-serial')
      }
    }
    if (action.requiresConfirmation && confirmed !== true) {
      return reject('This action requires explicit confirmation.', 'confirmation-required')
    }

    const resolved = this.resolveTool(action.tool)
    if ('error' in resolved) {
      return reject(resolved.error, 'not-installed')
    }

    let result: RunContext
    if (action.id === 'fastboot-info') {
      result = await this.runFastbootInfo(resolved.path, serial as string)
    } else {
      result = await this.runOnce(resolved.path, action.args, serial)
    }

    return this.finish(action.id, action.tool, command, startedAt, started, result)
  }

  private async runOnce(
    exe: string,
    args: string[],
    serial: string | null
  ): Promise<RunContext> {
    const started = Date.now()
    const process = await execute(exe, serial ? ['-s', serial, ...args] : args)
    const output = truncate(
      [process.stdout, process.stderr]
        .map((value) => value.trimEnd())
        .filter(Boolean)
        .join('\n')
    )

    if (process.timedOut) {
      return {
        ok: false,
        output,
        error: 'The command timed out. The device did not answer in time.',
        errorCode: 'timeout',
        exitCode: null,
        durationMs: Date.now() - started
      }
    }
    if (process.spawnError) {
      return {
        ok: false,
        output,
        error: process.spawnError,
        errorCode: 'spawn-failed',
        exitCode: null,
        durationMs: Date.now() - started
      }
    }

    const ok = process.exitCode === 0
    return {
      ok,
      output,
      error: ok ? null : failureMessage(process, 'The command returned an error.'),
      errorCode: ok ? null : 'failed',
      exitCode: process.exitCode,
      durationMs: Date.now() - started
    }
  }

  /**
   * Runs only fixed read-only getvar calls. Nothing here can flash or erase.
   */
  private async runFastbootInfo(
    exe: string,
    serial: string
  ): Promise<RunContext> {
    const started = Date.now()
    const keys = ['product', 'unlocked', 'current-slot', 'slot-count']
    const chunks: string[] = []
    let ok = true

    for (const key of keys) {
      const process = await execute(exe, ['-s', serial, 'getvar', key], 15_000)
      const text = [process.stdout, process.stderr].filter(Boolean).join('\n').trim()
      chunks.push(`[${key}]\n${text || '(no output)'}`)
      if (process.exitCode !== 0 || process.timedOut) ok = false
    }

    return {
      ok,
      output: truncate(chunks.join('\n\n')),
      error: ok ? null : 'One or more fastboot variables could not be read.',
      errorCode: ok ? null : 'failed',
      exitCode: ok ? 0 : null,
      durationMs: Date.now() - started
    }
  }

  private resolveTool(tool: AdbToolName): { path: string } | { error: string } {
    if (!this.platformTools.getStatus().installed) {
      return { error: 'Platform Tools is not installed. Download it from the official source first.' }
    }
    const path = tool === 'adb' ? this.platformTools.getAdbPath() : this.platformTools.getFastbootPath()
    if (!path) {
      return { error: 'Platform Tools is not ready. Reinstall it from the official source.' }
    }
    return { path }
  }

  private finish(
    action: AdbActionId,
    tool: AdbToolName,
    command: string,
    startedAt: string,
    started: number,
    result: RunContext,
    record = true
  ): AdbActionResult {
    const entry: AdbLogEntry = {
      id: randomUUID(),
      action,
      tool,
      command,
      output: result.output,
      error: result.error,
      errorCode: result.errorCode,
      ok: result.ok,
      exitCode: result.exitCode,
      durationMs: result.durationMs || Date.now() - started,
      startedAt
    }

    if (record) {
      this.log.push(entry)
      if (this.log.length > MAX_LOG_ENTRIES) this.log = this.log.slice(-MAX_LOG_ENTRIES)
      this.broadcast(entry)
      this.recordHistory?.({
        category: tool,
        action,
        command,
        serial: /(?:^|\s)-s\s+(\S+)/.exec(command)?.[1] ?? null,
        result: result.ok ? 'success' : 'failure',
        detail: result.error,
        startedAt
      })
    }

    const { id: _unused, ...actionResult } = entry
    void _unused
    return actionResult
  }

  private broadcast(entry: AdbLogEntry): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC.adbLogUpdate, entry)
      }
    }
  }
}
