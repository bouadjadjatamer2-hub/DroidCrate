import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { LessonLibrary } from '@shared/learning'
import { parseLessonLibrary } from '@shared/lessonSchema'
import { dataDirectory } from '../paths'

interface CachedLessons {
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
  const root = dataDirectory()
  const catalogFile = join(root, 'lessons.json')
  const raw = await readFile(catalogFile, 'utf8')
  const parsed = parseLessonLibrary(JSON.parse(raw))

  const files = [catalogFile, ...parsed.lessons.map((lesson) => join(root, lesson.bodyFile))]
  const mtimeMs = await newestMtime(files)
  if (cache && cache.mtimeMs === mtimeMs) return cache.library

  const bodies = await Promise.all(
    parsed.lessons.map(async (lesson) => {
      const body = await readFile(join(root, lesson.bodyFile), 'utf8')
      return [lesson.id, body] as const
    })
  )
  const bodyById = new Map(bodies)

  const library: LessonLibrary = {
    ...parsed,
    lessons: parsed.lessons.map((lesson) => ({
      ...lesson,
      body: bodyById.get(lesson.id) ?? ''
    }))
  }

  cache = { mtimeMs, library }
  return library
}
