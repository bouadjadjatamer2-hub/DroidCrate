import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { toolLibrarySchema } from '@shared/toolSchema'
import type { ToolLibrary } from '@shared/tools'

const raw = JSON.parse(readFileSync(resolve(process.cwd(), 'data/tools.json'), 'utf8'))
const library = toolLibrarySchema.parse(raw) as ToolLibrary

describe('tool library data', () => {
  it('is valid and contains at least fifteen tools', () => {
    expect(library.tools.length).toBeGreaterThanOrEqual(15)
  })

  it('uses unique ids', () => {
    const ids = library.tools.map((tool) => tool.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only links to secure official sources', () => {
    for (const tool of library.tools) {
      for (const link of tool.links) {
        expect(link.url.startsWith('https://')).toBe(true)
      }
    }
  })

  it('does not mark support-only tools as direct downloads', () => {
    for (const tool of library.tools) {
      if (tool.availability !== 'support-only') continue
      expect(tool.links.some((link) => link.kind === 'download')).toBe(false)
    }
  })

  it('explains the risk for every flashing and root tool', () => {
    for (const tool of library.tools) {
      if (tool.category === 'flashing' || tool.category === 'root') {
        expect(tool.warning, `${tool.id} needs a warning`).toBeTruthy()
      }
    }
  })
})
