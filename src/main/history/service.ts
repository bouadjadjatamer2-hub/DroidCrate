import type { HistoryEntry, HistoryInput } from '@shared/history'
import { historyToCsv, historyToText } from '@shared/history'
import type { LearningStore } from '../learning/store'

/**
 * Writes the operation log to SQLite. Recording must never block or break the
 * command that produced it, so failures are swallowed after the operation.
 */
export class HistoryService {
  constructor(private readonly store: LearningStore) {}

  record(entry: HistoryInput): void {
    try {
      this.store.addHistory(entry)
    } catch {
      // A broken history table must not stop a device command.
    }
  }

  list(): HistoryEntry[] {
    return this.store.listHistory()
  }

  clear(): void {
    this.store.clearHistory()
  }

  exportContent(format: 'txt' | 'csv'): string {
    const entries = this.list()
    return format === 'csv' ? historyToCsv(entries) : historyToText(entries)
  }
}
