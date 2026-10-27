import { readFile, stat } from 'node:fs/promises'
import type { ChecklistLibrary } from '@shared/checklists'
import { checklistLibrarySchema } from '@shared/checklistSchema'
import { contentRevision, resolveContentPath } from '../paths'

interface CachedChecklists {
  revision: number
  mtimeMs: number
  library: ChecklistLibrary
}

let cache: CachedChecklists | null = null

export async function loadChecklistLibrary(): Promise<ChecklistLibrary> {
  const file = resolveContentPath('checklists.json')
  const info = await stat(file)
  const revision = contentRevision()
  if (cache && cache.revision === revision && cache.mtimeMs === info.mtimeMs) {
    return cache.library
  }

  const raw = await readFile(file, 'utf8')
  const parsed = checklistLibrarySchema.parse(JSON.parse(raw)) as ChecklistLibrary
  cache = { revision, mtimeMs: info.mtimeMs, library: parsed }
  return parsed
}
