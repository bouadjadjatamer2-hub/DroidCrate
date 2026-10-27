import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { ToolLibrary } from '@shared/tools'
import { toolLibrarySchema } from '@shared/toolSchema'
import { dataDirectory } from '../paths'

interface CachedLibrary {
  mtimeMs: number
  library: ToolLibrary
}

let cache: CachedLibrary | null = null

export async function loadToolLibrary(): Promise<ToolLibrary> {
  const file = join(dataDirectory(), 'tools.json')
  const info = await stat(file)
  if (cache && cache.mtimeMs === info.mtimeMs) return cache.library

  const raw = await readFile(file, 'utf8')
  const parsed = toolLibrarySchema.parse(JSON.parse(raw)) as ToolLibrary
  cache = { mtimeMs: info.mtimeMs, library: parsed }
  return parsed
}
