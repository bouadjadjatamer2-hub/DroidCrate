import type {
  ChecklistProgressMap,
  LearningState,
  Lesson,
  LessonLibrary,
  QuizResult,
  QuizReviewItem
} from '@shared/learning'
import { QUIZ_PASS_RATIO } from '@shared/learning'
import type { LearningStore } from './store'
import { loadLessonLibrary } from './library'

const ID_PATTERN = /^[a-z0-9-]{1,64}$/

function isId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

/**
 * Coordinates the read-only lesson catalog with the SQLite progress store.
 * Quiz answers are scored here, so the renderer can never submit a score.
 */
export class LearningService {
  constructor(
    private readonly store: LearningStore,
    private readonly loadLibrary: () => Promise<LessonLibrary> = loadLessonLibrary
  ) {}

  async getState(): Promise<LearningState> {
    return {
      progress: this.store.getLessonProgress(),
      checklists: this.store.getChecklists()
    }
  }

  getChecklists(): ChecklistProgressMap {
    return this.store.getChecklists()
  }

  saveChecklist(
    checklistId: unknown,
    checked: unknown,
    completedAt: unknown
  ): ChecklistProgressMap {
    if (!isId(checklistId)) throw new Error('Invalid checklist id.')
    if (!Array.isArray(checked) || checked.length > 300 || !checked.every(isId)) {
      throw new Error('Invalid checklist items.')
    }
    if (completedAt !== null && typeof completedAt !== 'string') {
      throw new Error('Invalid completion time.')
    }
    const unique = [...new Set(checked)].slice(0, 300)
    this.store.saveChecklist(checklistId, { checked: unique, completedAt })
    return this.store.getChecklists()
  }

  resetChecklist(checklistId: unknown): ChecklistProgressMap {
    if (!isId(checklistId)) throw new Error('Invalid checklist id.')
    this.store.resetChecklist(checklistId)
    return this.store.getChecklists()
  }

  importChecklists(records: unknown): number {
    if (typeof records !== 'object' || records === null) return 0
    const clean: ChecklistProgressMap = {}
    for (const [checklistId, value] of Object.entries(records)) {
      if (!isId(checklistId) || typeof value !== 'object' || value === null) continue
      const record = value as { checked?: unknown; completedAt?: unknown }
      if (!Array.isArray(record.checked) || !record.checked.every(isId)) continue
      clean[checklistId] = {
        checked: [...new Set(record.checked)].slice(0, 300),
        completedAt: typeof record.completedAt === 'string' ? record.completedAt : null
      }
    }
    return this.store.importChecklists(clean)
  }

  async submitQuiz(lessonId: unknown, answers: unknown): Promise<QuizResult> {
    if (!isId(lessonId)) throw new Error('Invalid lesson id.')
    const library = await this.loadLibrary()
    const lesson: Lesson | undefined = library.lessons.find((item) => item.id === lessonId)
    if (!lesson) throw new Error('Unknown lesson.')
    if (!Array.isArray(answers) || answers.length !== lesson.quiz.length) {
      throw new Error('Every question must be answered.')
    }

    const review: QuizReviewItem[] = lesson.quiz.map((question, index) => {
      const chosen = answers[index]
      const valid =
        typeof chosen === 'number' &&
        Number.isInteger(chosen) &&
        chosen >= 0 &&
        chosen < question.options.length
      if (!valid) throw new Error('One or more answers are invalid.')
      return {
        questionId: question.id,
        chosen,
        answer: question.answer,
        correct: chosen === question.answer,
        explanation: question.explanation
      }
    })

    const score = review.filter((item) => item.correct).length
    const total = review.length
    const passed = score / total >= QUIZ_PASS_RATIO
    const progress = this.store.recordQuizAttempt(lesson.id, score, total, passed)

    return {
      lessonId: lesson.id,
      score,
      total,
      passed,
      review,
      progress
    }
  }

  async resetLesson(lessonId: unknown): Promise<void> {
    if (!isId(lessonId)) throw new Error('Invalid lesson id.')
    const library = await this.loadLibrary()
    if (!library.lessons.some((lesson) => lesson.id === lessonId)) {
      throw new Error('Unknown lesson.')
    }
    this.store.resetLesson(lessonId)
  }

  async getLessonLibrary(): Promise<LessonLibrary> {
    return this.loadLibrary()
  }
}
