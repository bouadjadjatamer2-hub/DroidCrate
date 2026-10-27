import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseLessonLibrary } from '@shared/lessonSchema'
import type { LessonLibrary } from '@shared/learning'
import { LearningStore } from '../src/main/learning/store'
import { LearningService } from '../src/main/learning/service'

const project = process.cwd()
const cleanup: Array<() => void> = []

afterEach(() => {
  while (cleanup.length > 0) cleanup.pop()?.()
})

function createService(): LearningService {
  const directory = mkdtempSync(join(tmpdir(), 'droidcrate-test-'))
  const store = new LearningStore(join(directory, 'learning.db'))
  cleanup.push(() => {
    store.close()
    rmSync(directory, { recursive: true, force: true })
  })

  const library: LessonLibrary = {
    schemaVersion: 1,
    updated: '2026-10-26',
    levels: [
      { id: 'basic', title: 'Basic', summary: 'Basics' },
      { id: 'intermediate', title: 'Intermediate', summary: 'Middle' },
      { id: 'advanced', title: 'Advanced', summary: 'Advanced' }
    ],
    lessons: [
      {
        id: 'intro',
        level: 'basic',
        title: 'Intro',
        summary: 'Test lesson',
        minutes: 5,
        body: '# Intro',
        quiz: [
          { id: 'q1', prompt: 'One?', options: ['a', 'b'], answer: 0, explanation: 'A.' },
          { id: 'q2', prompt: 'Two?', options: ['a', 'b'], answer: 1, explanation: 'B.' },
          { id: 'q3', prompt: 'Three?', options: ['a', 'b'], answer: 0, explanation: 'A.' }
        ]
      }
    ]
  }

  return new LearningService(store, async () => library)
}

describe('lesson catalog', () => {
  it('parses the shipped catalog and finds every Markdown file', () => {
    const raw = JSON.parse(readFileSync(join(project, 'data/lessons.json'), 'utf8')) as unknown
    const catalog = parseLessonLibrary(raw)

    expect(catalog.levels).toHaveLength(3)
    expect(catalog.lessons.length).toBeGreaterThanOrEqual(9)

    for (const lesson of catalog.lessons) {
      const file = join(project, 'data', lesson.bodyFile)
      expect(statSync(file).size).toBeGreaterThan(200)
      expect(lesson.quiz.length).toBeGreaterThanOrEqual(2)
      for (const question of lesson.quiz) {
        expect(question.answer).toBeGreaterThanOrEqual(0)
        expect(question.answer).toBeLessThan(question.options.length)
      }
    }
  })

  it('rejects duplicate lesson ids and broken answers', () => {
    const base = JSON.parse(readFileSync(join(project, 'data/lessons.json'), 'utf8')) as Record<string, unknown>
    const duplicate = structuredClone(base) as { lessons: Array<Record<string, unknown>> }
    duplicate.lessons.push(structuredClone(duplicate.lessons[0]))
    expect(() => parseLessonLibrary(duplicate)).toThrow()

    const broken = structuredClone(base) as {
      lessons: Array<{ quiz: Array<{ answer: number; options: string[] }> }>
    }
    broken.lessons[0].quiz[0].answer = 9
    expect(() => parseLessonLibrary(broken)).toThrow()
  })
})

describe('learning service', () => {
  it('scores a quiz, keeps the best score, and completes the lesson', async () => {
    const service = createService()

    const first = await service.submitQuiz('intro', [0, 1, 0])
    expect(first.score).toBe(3)
    expect(first.total).toBe(3)
    expect(first.passed).toBe(true)
    expect(first.progress.completedAt).not.toBeNull()
    expect(first.review.every((item) => item.correct)).toBe(true)

    const second = await service.submitQuiz('intro', [0, 0, 0])
    expect(second.score).toBe(2)
    expect(second.passed).toBe(true)
    expect(second.progress.attempts).toBe(2)
    expect(second.progress.bestScore).toBe(3)

    const state = await service.getState()
    expect(state.progress).toHaveLength(1)
    expect(state.progress[0].completedAt).not.toBeNull()
  })

  it('fails below the pass mark and rejects malformed answers', async () => {
    const service = createService()

    const failed = await service.submitQuiz('intro', [1, 0, 1])
    expect(failed.score).toBe(0)
    expect(failed.passed).toBe(false)
    expect(failed.progress.completedAt).toBeNull()

    await expect(service.submitQuiz('intro', [0, 1])).rejects.toThrow()
    await expect(service.submitQuiz('intro', [0, 9, 0])).rejects.toThrow()
    await expect(service.submitQuiz('missing', [0, 1, 0])).rejects.toThrow()
  })

  it('saves, resets, and imports checklist progress once', async () => {
    const service = createService()

    const saved = service.saveChecklist('boot-unlock', ['step-a', 'step-b'], null)
    expect(saved['boot-unlock'].checked).toEqual(['step-a', 'step-b'])

    const completed = service.saveChecklist('boot-unlock', ['step-a'], '2026-10-26T10:00:00.000Z')
    expect(completed['boot-unlock'].completedAt).toBe('2026-10-26T10:00:00.000Z')

    expect(service.resetChecklist('boot-unlock')).toEqual({})
    expect(() => service.saveChecklist('Bad Id', ['step-a'], null)).toThrow()

    const imported = service.importChecklists({
      'legacy-one': { checked: ['step-a'], completedAt: null }
    })
    expect(imported).toBe(1)
    expect(service.importChecklists({ 'legacy-one': { checked: ['step-b'], completedAt: null } })).toBe(0)
    expect(service.getChecklists()['legacy-one'].checked).toEqual(['step-a'])
  })

  it('clears lesson progress on request', async () => {
    const service = createService()
    await service.submitQuiz('intro', [0, 1, 0])
    await service.resetLesson('intro')

    const state = await service.getState()
    expect(state.progress).toEqual([])
    await expect(service.resetLesson('missing')).rejects.toThrow()
  })
})
