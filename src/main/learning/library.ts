import { readFile, stat } from 'node:fs/promises'
import type { LessonLibrary } from '@shared/learning'
import { parseLessonLibrary } from '@shared/lessonSchema'
import { contentRevision, resolveContentPath } from '../paths'

interface CachedLessons {
  revision: number
  mtimeMs: number
  library: LessonLibrary
}

let cache: CachedLessons | null = null

async function newestMtime(files: string[]): Promise<number> {
  const stats = await Promise.all(files.map((file) => stat(file)))
  return stats.reduce((newest, info) => Math.max(newest, info.mtimeMs), 0)
}

/**
 * Loads the lesson catalog and inlines each Markdown body in both languages.
 * Editing a lesson file or the catalog invalidates the cache on the next read.
 */
export async function loadLessonLibrary(): Promise<LessonLibrary> {
  const catalogFile = resolveContentPath('lessons.json')
  const raw = await readFile(catalogFile, 'utf8')
  const parsed = parseLessonLibrary(JSON.parse(raw))

  const files = [
    catalogFile,
    ...parsed.lessons.flatMap((lesson) => [
      resolveContentPath(lesson.bodyFile),
      resolveContentPath(lesson.bodyFileAr)
    ])
  ]
  const mtimeMs = await newestMtime(files)
  const revision = contentRevision()
  if (cache && cache.revision === revision && cache.mtimeMs === mtimeMs) return cache.library

  const bodies = await Promise.all(
    parsed.lessons.map(async (lesson) => {
      const [body, bodyAr] = await Promise.all([
        readFile(resolveContentPath(lesson.bodyFile), 'utf8'),
        readFile(resolveContentPath(lesson.bodyFileAr), 'utf8')
      ])
      return [lesson.id, { body, bodyAr }] as const
    })
  )
  const bodyById = new Map(bodies)

  const library: LessonLibrary = {
    ...parsed,
    lessons: parsed.lessons.map((lesson) => {
      const { bodyFile: _bodyFile, bodyFileAr: _bodyFileAr, ...rest } = lesson
      const inline = bodyById.get(lesson.id)
      return {
        ...rest,
        body: inline?.body ?? '',
        bodyAr: inline?.bodyAr ?? ''
      }
    })
  }

  cache = { revision, mtimeMs, library }
  return library
}
