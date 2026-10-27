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
 * Loads the lesson catalog and inlines each Markdown body. Editing a lesson
 * file or the catalog invalidates the cache on the next read.
 */
export async function loadLessonLibrary(): Promise<LessonLibrary> {
  const catalogFile = resolveContentPath('lessons.json')
  const raw = await readFile(catalogFile, 'utf8')
  const parsed = parseLessonLibrary(JSON.parse(raw))

  const files = [catalogFile, ...parsed.lessons.map((lesson) => resolveContentPath(lesson.bodyFile))]
  const mtimeMs = await newestMtime(files)
  const revision = contentRevision()
  if (cache && cache.revision === revision && cache.mtimeMs === mtimeMs) return cache.library

  const bodies = await Promise.all(
    parsed.lessons.map(async (lesson) => {
      const body = await readFile(resolveContentPath(lesson.bodyFile), 'utf8')
      return [lesson.id, body] as const
    })
  )
  const bodyById = new Map(bodies)

  const library: LessonLibrary = {
    ...parsed,
    lessons: parsed.lessons.map((lesson) => {
      const { bodyFile: _bodyFile, ...rest } = lesson
      return {
        ...rest,
        body: bodyById.get(lesson.id) ?? ''
      }
    })
  }

  cache = { revision, mtimeMs, library }
  return library
}
