import { describe, expect, it } from 'vitest'
import { isSymlinkEntry, safeEntryName } from '../src/main/platformTools/zip'

describe('safe archive extraction', () => {
  it('accepts normal relative paths', () => {
    expect(safeEntryName('platform-tools/adb.exe')).toBe('platform-tools/adb.exe')
    expect(safeEntryName('adb.exe')).toBe('adb.exe')
    expect(safeEntryName('platform-tools/lib/x86_64/a.dll')).toBe(
      'platform-tools/lib/x86_64/a.dll'
    )
  })

  it('rejects traversal, absolute paths, and Windows drive prefixes', () => {
    expect(safeEntryName('../escape.exe')).toBeNull()
    expect(safeEntryName('platform-tools/../../escape.exe')).toBeNull()
    expect(safeEntryName('/absolute.exe')).toBeNull()
    expect(safeEntryName('C:/windows/system32/cmd.exe')).toBeNull()
    expect(safeEntryName('platform-tools\\..\\escape.exe')).toBeNull()
    expect(safeEntryName('platform-tools//adb.exe')).toBeNull()
    expect(safeEntryName('')).toBeNull()
  })

  it('detects Unix symlink entries', () => {
    expect(isSymlinkEntry((0o120777 << 16) >>> 0)).toBe(true)
    expect(isSymlinkEntry((0o100644 << 16) >>> 0)).toBe(false)
    expect(isSymlinkEntry(0)).toBe(false)
  })
})
