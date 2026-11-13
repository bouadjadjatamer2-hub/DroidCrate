import { z } from 'zod'
import type { LessonCatalog } from './learning'

const levelIdSchema = z.enum(['basic', 'intermediate', 'advanced'])

const glossarySchema = z.object({
  term: z.string().min(1),
  termAr: z.string().min(1),
  arabic: z.string().min(1),
  english: z.string().min(1)
})

const questionSchema = z
  .object({
    id: z.string().min(1),
    prompt: z.string().min(1),
    promptAr: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(5),
    optionsAr: z.array(z.string().min(1)).min(2).max(5),
    answer: z.number().int().min(0),
    explanation: z.string().min(1),
    explanationAr: z.string().min(1)
  })
  .refine((question) => question.answer < question.options.length, {
    message: 'Quiz answers must point at an existing option.'
  })
  .refine((question) => question.optionsAr.length === question.options.length, {
    message: 'Arabic quiz options must keep the same order and count as the English options.'
  })

const lessonSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  level: levelIdSchema,
  title: z.string().min(1),
  titleAr: z.string().min(1),
  summary: z.string().min(1),
  summaryAr: z.string().min(1),
  minutes: z.number().int().min(1).max(120),
  /** Markdown file relative to the data directory, for example lessons/boot-chain.md */
  bodyFile: z.string().regex(/^lessons\/[a-z0-9-]+\.md$/),
  /** Arabic Markdown file, for example lessons/boot-chain.ar.md */
  bodyFileAr: z.string().regex(/^lessons\/[a-z0-9-]+\.ar\.md$/),
  glossary: z.array(glossarySchema).min(1).max(20),
  quiz: z.array(questionSchema).min(2).max(5)
})

export const lessonLibrarySchema = z
  .object({
    schemaVersion: z.literal(1),
    updated: z.string().min(1),
    levels: z.array(
      z.object({
        id: levelIdSchema,
        title: z.string().min(1),
        titleAr: z.string().min(1),
        summary: z.string().min(1),
        summaryAr: z.string().min(1)
      })
    ).length(3),
    lessons: z.array(lessonSchema).min(3)
  })
  .superRefine((library, context) => {
    const levelIds = new Set(library.levels.map((level) => level.id))
    if (levelIds.size !== 3) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Level ids must be unique.' })
    }

    const lessonIds = new Set<string>()
    for (const lesson of library.lessons) {
      if (!levelIds.has(lesson.level)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Lesson ${lesson.id} points at an unknown level.`
        })
      }
      if (lessonIds.has(lesson.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate lesson id: ${lesson.id}`
        })
      }
      lessonIds.add(lesson.id)

      const terms = new Set<string>()
      for (const entry of lesson.glossary) {
        if (terms.has(entry.term)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate glossary term ${entry.term} in ${lesson.id}`
          })
        }
        terms.add(entry.term)
      }

      const questionIds = new Set<string>()
      for (const question of lesson.quiz) {
        if (questionIds.has(question.id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate question id ${question.id} in ${lesson.id}`
          })
        }
        questionIds.add(question.id)
      }
    }

    for (const level of library.levels) {
      if (!library.lessons.some((lesson) => lesson.level === level.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Level ${level.id} has no lessons.`
        })
      }
    }
  })

export function parseLessonLibrary(raw: unknown): LessonCatalog {
  return lessonLibrarySchema.parse(raw) as LessonCatalog
}
