export type LessonLevelId = 'basic' | 'intermediate' | 'advanced'

/** A hard word or abbreviation explained in both languages. */
export interface GlossaryEntry {
  /** The English term exactly as it appears in the lesson. */
  term: string
  /** The Arabic rendering of the term. */
  termAr: string
  /** Plain-language explanation in Arabic. */
  arabic: string
  /** Plain-language explanation in English. */
  english: string
}

export interface LessonLevel {
  id: LessonLevelId
  title: string
  titleAr?: string
  summary: string
  summaryAr?: string
}

export interface QuizQuestion {
  id: string
  prompt: string
  promptAr?: string
  options: string[]
  optionsAr?: string[]
  /** Index of the correct option inside `options`. The Arabic list keeps the same order. */
  answer: number
  explanation: string
  explanationAr?: string
}

export interface Lesson {
  id: string
  level: LessonLevelId
  title: string
  titleAr?: string
  summary: string
  summaryAr?: string
  minutes: number
  /** Lesson body in Markdown. Rendered read-only inside the app. */
  body: string
  /** Faithful Arabic body. Falls back to the English body when missing. */
  bodyAr?: string
  /** Vocabulary notes shown under the body in both languages. */
  glossary?: GlossaryEntry[]
  quiz: QuizQuestion[]
}

export interface LessonLibrary {
  schemaVersion: number
  updated: string
  levels: LessonLevel[]
  lessons: Lesson[]
}

/** The on-disk catalog points at Markdown files instead of inlining bodies. */
export interface LessonCatalogEntry extends Omit<Lesson, 'body' | 'bodyAr'> {
  bodyFile: string
  /** Arabic Markdown file, for example lessons/boot-chain.ar.md */
  bodyFileAr: string
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
