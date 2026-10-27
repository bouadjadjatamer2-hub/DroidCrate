import { z } from 'zod'
import type { LessonCatalog } from './learning'

const levelIdSchema = z.enum(['basic', 'intermediate', 'advanced'])

const questionSchema = z
  .object({
    id: z.string().min(1),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(5),
    answer: z.number().int().min(0),
    explanation: z.string().min(1)
  })
  .refine((question) => question.answer < question.options.length, {
    message: 'Quiz answers must point at an existing option.'
  })

const lessonSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  level: levelIdSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  minutes: z.number().int().min(1).max(120),
  /** Markdown file relative to the data directory, for example lessons/boot-chain.md */
  bodyFile: z.string().regex(/^lessons\/[a-z0-9-]+\.md$/),
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
        summary: z.string().min(1)
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
