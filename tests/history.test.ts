import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { HistoryEntry } from '@shared/history'
import { historyToCsv, historyToText } from '@shared/history'
import { LearningStore } from '../src/main/learning/store'

const cleanup: Array<() => void> = []

afterEach(() => {
  while (cleanup.length > 0) cleanup.pop()?.()
})

function createStore(): LearningStore {
  const directory = mkdtempSync(join(tmpdir(), 'droidcrate-history-'))
  const store = new LearningStore(join(directory, 'history.db'))
  cleanup.push(() => {
    store.close()
    rmSync(directory, { recursive: true, force: true })
  })
  return store
}

describe('operation history', () => {
  it('stores newest entries first and clears them', () => {
    const store = createStore()

    store.addHistory({
      category: 'adb',
      action: 'adb-version',
      command: 'adb version',
      serial: null,
      result: 'success',
      detail: null,
      startedAt: '2026-10-26T10:00:00.000Z'
    })
    store.addHistory({
      category: 'fastboot',
      action: 'fastboot-info',
      command: 'fastboot -s ABC123 getvar product',
      serial: 'ABC123',
      result: 'failure',
      detail: 'The command timed out.',
      startedAt: '2026-10-26T10:05:00.000Z'
    })

    const entries = store.listHistory()
    expect(entries).toHaveLength(2)
    expect(entries[0].serial).toBe('ABC123')
    expect(entries[0].result).toBe('failure')
    expect(entries[0].startedAt).toBe('2026-10-26T10:05:00.000Z')
    expect(entries[0].createdAt).toBeTruthy()
    expect(entries[1].action).toBe('adb-version')

    store.clearHistory()
    expect(store.listHistory()).toEqual([])
  })

  it('writes readable TXT and quoted CSV exports', () => {
    const entries: HistoryEntry[] = [
      {
        id: 1,
        category: 'checklist',
        action: 'checklist-complete',
        command: 'Complete checklist: Restore stock firmware',
        serial: null,
        result: 'success',
        detail: 'Contains "quotes", commas, and\nnew lines',
        startedAt: '2026-10-26T10:00:00.000Z',
        createdAt: '2026-10-26T10:00:01.000Z'
      }
    ]

    const csv = historyToCsv(entries)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"Contains ""quotes"", commas, and\nnew lines"')

    const text = historyToText(entries)
    expect(text).toContain('DroidCrate operation history')
    expect(text).toContain('Complete checklist: Restore stock firmware')
    expect(text).toContain('[SUCCESS]')
  })
})
