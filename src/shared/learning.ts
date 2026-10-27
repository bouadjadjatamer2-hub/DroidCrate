export type LessonLevelId = 'basic' | 'intermediate' | 'advanced'

export interface LessonLevel {
  id: LessonLevelId
  title: string
  summary: string
}

export interface QuizQuestion {
  id: string
  prompt: string
  options: string[]
  /** Index of the correct option inside `options`. */
  answer: number
  explanation: string
}

export interface Lesson {
  id: string
  level: LessonLevelId
  title: string
  summary: string
  minutes: number
  /** Lesson body in Markdown. Rendered read-only inside the app. */
  body: string
  quiz: QuizQuestion[]
}

export interface LessonLibrary {
  schemaVersion: number
  updated: string
  levels: LessonLevel[]
  lessons: Lesson[]
}

/** The on-disk catalog points at Markdown files instead of inlining bodies. */
export interface LessonCatalogEntry extends Omit<Lesson, 'body'> {
  bodyFile: string
}

export interface LessonCatalog {
  schemaVersion: number
  updated: string
  levels: LessonLevel[]
  lessons: LessonCatalogEntry[]
}

export interface LessonProgress {
  lessonId: string
  attempts: number
  bestScore: number
  total: number
  completedAt: string | null
  updatedAt: string
}

export interface QuizReviewItem {
  questionId: string
  chosen: number | null
  answer: number
  correct: boolean
  explanation: string
}

export interface QuizResult {
  lessonId: string
  score: number
  total: number
  /** True when the score reaches the pass mark (70%). */
  passed: boolean
  review: QuizReviewItem[]
  progress: LessonProgress
}

export interface ChecklistProgressRecord {
  checked: string[]
  completedAt: string | null
}

export type ChecklistProgressMap = Record<string, ChecklistProgressRecord>

export interface LearningState {
  progress: LessonProgress[]
  checklists: ChecklistProgressMap
}

/** A quiz is passed at 60% or more, so two correct answers out of three pass. */
export const QUIZ_PASS_RATIO = 0.6
