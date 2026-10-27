import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type {
  ChecklistProgressMap,
  ChecklistProgressRecord,
  LessonProgress
} from '@shared/learning'
import type {
  HistoryCategory,
  HistoryEntry,
  HistoryInput,
  HistoryResult
} from '@shared/history'

interface LessonProgressRow {
  lesson_id: string
  attempts: number
  best_score: number
  total: number
  completed_at: string | null
  updated_at: string
}

interface ChecklistRow {
  checklist_id: string
  checked_json: string
  completed_at: string | null
}

interface HistoryRow {
  id: number
  category: HistoryCategory
  action: string
  command: string
  serial: string | null
  result: HistoryResult
  detail: string | null
  started_at: string
  created_at: string
}

function parseChecked(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string').slice(0, 300)
  } catch {
    return []
  }
}

function toProgress(row: LessonProgressRow): LessonProgress {
  return {
    lessonId: row.lesson_id,
    attempts: row.attempts,
    bestScore: row.best_score,
    total: row.total,
    completedAt: row.completed_at,
    updatedAt: row.updated_at
  }
}

/**
 * Local SQLite storage for learning progress and checklist state.
 * The database lives in the Electron user-data directory so it survives
 * reinstalls and never leaves the machine.
 */
export class LearningStore {
  private readonly db: DatabaseSync

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true })
    this.db = new DatabaseSync(databasePath)
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS lesson_progress (
        lesson_id TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 0,
        best_score INTEGER NOT NULL DEFAULT 0,
        total INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lesson_id TEXT NOT NULL,
        score INTEGER NOT NULL,
        total INTEGER NOT NULL,
        passed INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS checklist_progress (
        checklist_id TEXT PRIMARY KEY,
        checked_json TEXT NOT NULL,
        completed_at TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS operation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        action TEXT NOT NULL,
        command TEXT NOT NULL,
        serial TEXT,
        result TEXT NOT NULL,
        detail TEXT,
        started_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_history_started
        ON operation_history (started_at DESC);
    `)
  }

  getLessonProgress(): LessonProgress[] {
    const rows = this.db
      .prepare(
        `SELECT lesson_id, attempts, best_score, total, completed_at, updated_at
         FROM lesson_progress
         ORDER BY updated_at DESC`
      )
      .all() as unknown as LessonProgressRow[]
    return rows.map(toProgress)
  }

  getChecklists(): ChecklistProgressMap {
    const rows = this.db
      .prepare('SELECT checklist_id, checked_json, completed_at FROM checklist_progress')
      .all() as unknown as ChecklistRow[]
    const result: ChecklistProgressMap = {}
    for (const row of rows) {
      result[row.checklist_id] = {
        checked: parseChecked(row.checked_json),
        completedAt: row.completed_at
      }
    }
    return result
  }

  saveChecklist(checklistId: string, record: ChecklistProgressRecord): void {
    const now = new Date().toISOString()
    this.db
      .prepare(
        `INSERT INTO checklist_progress (checklist_id, checked_json, completed_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(checklist_id) DO UPDATE SET
           checked_json = excluded.checked_json,
           completed_at = excluded.completed_at,
           updated_at = excluded.updated_at`
      )
      .run(checklistId, JSON.stringify(record.checked), record.completedAt, now)
  }

  resetChecklist(checklistId: string): void {
    this.db.prepare('DELETE FROM checklist_progress WHERE checklist_id = ?').run(checklistId)
  }

  /** Imports browser-era progress once, without overwriting newer SQLite rows. */
  importChecklists(records: ChecklistProgressMap): number {
    const statement = this.db.prepare(
      `INSERT OR IGNORE INTO checklist_progress
         (checklist_id, checked_json, completed_at, updated_at)
       VALUES (?, ?, ?, ?)`
    )
    const now = new Date().toISOString()
    let imported = 0
    for (const [checklistId, record] of Object.entries(records)) {
      const info = statement.run(
        checklistId,
        JSON.stringify(record.checked.slice(0, 300)),
        record.completedAt,
        now
      )
      imported += Number(info.changes)
    }
    return imported
  }

  recordQuizAttempt(lessonId: string, score: number, total: number, passed: boolean): LessonProgress {
    const now = new Date().toISOString()
    const existing = this.db
      .prepare('SELECT * FROM lesson_progress WHERE lesson_id = ?')
      .get(lessonId) as unknown as LessonProgressRow | undefined

    const attempts = (existing?.attempts ?? 0) + 1
    const bestScore = Math.max(existing?.best_score ?? 0, score)
    const completedAt = existing?.completed_at ?? (passed ? now : null)

    this.db
      .prepare(
        `INSERT INTO lesson_progress
           (lesson_id, attempts, best_score, total, completed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(lesson_id) DO UPDATE SET
           attempts = excluded.attempts,
           best_score = excluded.best_score,
           total = excluded.total,
           completed_at = excluded.completed_at,
           updated_at = excluded.updated_at`
      )
      .run(lessonId, attempts, bestScore, total, completedAt, now)

    this.db
      .prepare(
        `INSERT INTO quiz_attempts (lesson_id, score, total, passed, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(lessonId, score, total, passed ? 1 : 0, now)

    return {
      lessonId,
      attempts,
      bestScore,
      total,
      completedAt,
      updatedAt: now
    }
  }

  resetLesson(lessonId: string): void {
    this.db.prepare('DELETE FROM lesson_progress WHERE lesson_id = ?').run(lessonId)
  }

  addHistory(entry: HistoryInput): void {
    this.db
      .prepare(
        `INSERT INTO operation_history
           (category, action, command, serial, result, detail, started_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.category,
        entry.action,
        entry.command,
        entry.serial,
        entry.result,
        entry.detail,
        entry.startedAt,
        new Date().toISOString()
      )
  }

  listHistory(limit = 500): HistoryEntry[] {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 1000)
    const rows = this.db
      .prepare(
        `SELECT id, category, action, command, serial, result, detail, started_at, created_at
         FROM operation_history
         ORDER BY started_at DESC, id DESC
         LIMIT ?`
      )
      .all(safeLimit) as unknown as HistoryRow[]
    return rows.map((row) => ({
      id: row.id,
      category: row.category,
      action: row.action,
      command: row.command,
      serial: row.serial,
      result: row.result,
      detail: row.detail,
      startedAt: row.started_at,
      createdAt: row.created_at
    }))
  }

  clearHistory(): void {
    this.db.prepare('DELETE FROM operation_history').run()
  }

  close(): void {
    this.db.close()
  }
}
