import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checklistLibrarySchema } from '@shared/checklistSchema'
import type { ChecklistLibrary } from '@shared/checklists'

const raw = JSON.parse(readFileSync(resolve(process.cwd(), 'data/checklists.json'), 'utf8'))
const library = checklistLibrarySchema.parse(raw) as ChecklistLibrary

describe('checklist library data', () => {
  it('contains the five documented operations', () => {
    expect(library.checklists.map((checklist) => checklist.id)).toEqual([
      'stock-firmware',
      'bootloader-unlock',
      'custom-recovery',
      'root',
      'custom-rom'
    ])
  })

  it('gives every checklist at least one required step and a warning', () => {
    for (const checklist of library.checklists) {
      expect(checklist.items.some((item) => item.required), checklist.id).toBe(true)
      expect(checklist.warning.length, checklist.id).toBeGreaterThan(20)
    }
  })

  it('keeps item ids unique inside each checklist', () => {
    for (const checklist of library.checklists) {
      const ids = checklist.items.map((item) => item.id)
      expect(new Set(ids).size, checklist.id).toBe(ids.length)
    }
  })
})
