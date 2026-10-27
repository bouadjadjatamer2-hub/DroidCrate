import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { ChecklistLibrary } from '@shared/checklists'
import { checklistLibrarySchema } from '@shared/checklistSchema'
import { dataDirectory } from '../paths'

interface CachedChecklists {
  mtimeMs: number
  library: ChecklistLibrary
}

let cache: CachedChecklists | null = null

export async function loadChecklistLibrary(): Promise<ChecklistLibrary> {
  const file = join(dataDirectory(), 'checklists.json')
  const info = await stat(file)
  if (cache && cache.mtimeMs === info.mtimeMs) return cache.library

  const raw = await readFile(file, 'utf8')
  const parsed = checklistLibrarySchema.parse(JSON.parse(raw)) as ChecklistLibrary
  cache = { mtimeMs: info.mtimeMs, library: parsed }
  return parsed
}
