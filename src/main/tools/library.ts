import { readFile, stat } from 'node:fs/promises'
import type { ToolLibrary } from '@shared/tools'
import { toolLibrarySchema } from '@shared/toolSchema'
import { contentRevision, resolveContentPath } from '../paths'

interface CachedLibrary {
  revision: number
  mtimeMs: number
  library: ToolLibrary
}

let cache: CachedLibrary | null = null

export async function loadToolLibrary(): Promise<ToolLibrary> {
  const file = resolveContentPath('tools.json')
  const info = await stat(file)
  const revision = contentRevision()
  if (cache && cache.revision === revision && cache.mtimeMs === info.mtimeMs) return cache.library

  const raw = await readFile(file, 'utf8')
  const parsed = toolLibrarySchema.parse(JSON.parse(raw)) as ToolLibrary
  cache = { revision, mtimeMs: info.mtimeMs, library: parsed }
  return parsed
}
