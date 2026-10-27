import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PlatformToolsCatalog } from '@shared/platformTools'
import { platformToolsCatalogSchema } from '@shared/platformToolsSchema'
import { dataDirectory } from '../paths'

export async function loadPlatformToolsCatalog(): Promise<PlatformToolsCatalog> {
  const file = join(dataDirectory(), 'platform-tools.json')
  const raw = await readFile(file, 'utf8')
  return platformToolsCatalogSchema.parse(JSON.parse(raw)) as PlatformToolsCatalog
}
