export type HistoryCategory = 'adb' | 'fastboot' | 'platform-tools' | 'checklist'
export type HistoryResult = 'success' | 'failure'

export interface HistoryEntry {
  id: number
  category: HistoryCategory
  /** Stable action id, for example `adb-device-info`. */
  action: string
  /** Exact command or human-readable operation. */
  command: string
  serial: string | null
  result: HistoryResult
  detail: string | null
  startedAt: string
  createdAt: string
}

export type HistoryInput = Omit<HistoryEntry, 'id' | 'createdAt'>

export interface HistoryExportResult {
  saved: boolean
  path: string | null
  count: number
}

function csvCell(value: string | null): string {
  const text = value ?? ''
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

export function historyToCsv(entries: HistoryEntry[]): string {
  const header = ['date', 'category', 'action', 'command', 'serial', 'result', 'detail']
  const lines = [header.join(',')]
  for (const entry of entries) {
    lines.push(
      [
        entry.startedAt,
        entry.category,
        entry.action,
        entry.command,
        entry.serial,
        entry.result,
        entry.detail
      ]
        .map(csvCell)
        .join(',')
    )
  }
  // The BOM keeps Arabic text readable when the file opens in Excel.
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function historyToText(entries: HistoryEntry[]): string {
  const divider = '='.repeat(72)
  const blocks = entries.map((entry) =>
    [
      `${entry.startedAt}  [${entry.result.toUpperCase()}]  ${entry.category}`,
      `Action : ${entry.action}`,
      `Device : ${entry.serial ?? '—'}`,
      `Command: ${entry.command}`,
      entry.detail ? `Detail : ${entry.detail}` : null,
      divider
    ]
      .filter(Boolean)
      .join('\n')
  )
  return [`DroidCrate operation history`, divider, ...blocks].join('\n')
}
