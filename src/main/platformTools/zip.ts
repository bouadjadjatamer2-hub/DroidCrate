import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { open as openZipFile, type Entry, type ZipFile } from 'yauzl'

const MAX_ENTRIES = 2000
const MAX_FILE_BYTES = 64 * 1024 * 1024

/**
 * Returns a normalised relative path, or null when the archive entry tries to
 * escape the extraction root. Backslashes are rejected instead of normalised
 * so a Windows-built archive cannot smuggle traversal through them.
 */
export function safeEntryName(name: string): string | null {
  if (!name || name.includes('\\') || name.startsWith('/') || /^[a-zA-Z]:/.test(name)) {
    return null
  }
  const parts = name.split('/')
  if (parts.some((part) => part === '' || part === '.' || part === '..')) return null
  return parts.join('/')
}

/** Unix symlink entries carry S_IFLNK in the high 16 bits of the attributes. */
export function isSymlinkEntry(externalFileAttributes: number): boolean {
  const mode = (externalFileAttributes >>> 16) & 0xffff
  return (mode & 0xf000) === 0xa000
}

function openZip(path: string): Promise<ZipFile> {
  return new Promise((resolveZip, rejectZip) => {
    openZipFile(path, { lazyEntries: true, autoClose: false }, (error, zip) => {
      if (error || !zip) rejectZip(error ?? new Error('The archive could not be opened.'))
      else resolveZip(zip)
    })
  })
}

async function extractEntries(zip: ZipFile, targetDirectory: string): Promise<void> {
  const root = resolve(targetDirectory)
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`

  await new Promise<void>((resolveAll, rejectAll) => {
    let settled = false
    let entries = 0

    const fail = (error: Error): void => {
      if (settled) return
      settled = true
      rejectAll(error)
    }

    zip.on('error', fail)
    zip.on('end', () => {
      if (settled) return
      settled = true
      resolveAll()
    })

    zip.on('entry', (entry: Entry) => {
      const name = entry.fileName
      if (name.endsWith('/')) {
        entries += 1
        if (entries > MAX_ENTRIES) {
          fail(new Error('The archive contains too many entries.'))
          return
        }
        void mkdir(resolve(root, name), { recursive: true })
          .then(() => zip.readEntry())
          .catch((error: unknown) => fail(error instanceof Error ? error : new Error(String(error))))
        return
      }

      const safeName = safeEntryName(name)
      if (!safeName) {
        fail(new Error(`Unsafe archive entry: ${name}`))
        return
      }

      if (isSymlinkEntry(entry.externalFileAttributes)) {
        fail(new Error(`Symbolic links are not allowed in the archive: ${name}`))
        return
      }

      if (entry.uncompressedSize > MAX_FILE_BYTES) {
        fail(new Error(`Archive entry is too large: ${name}`))
        return
      }

      const target = resolve(root, safeName)
      if (!target.startsWith(rootPrefix)) {
        fail(new Error(`Unsafe archive entry: ${name}`))
        return
      }

      entries += 1
      if (entries > MAX_ENTRIES) {
        fail(new Error('The archive contains too many entries.'))
        return
      }

      zip.openReadStream(entry, (streamError, stream) => {
        if (streamError || !stream) {
          fail(streamError ?? new Error(`Could not read ${name}.`))
          return
        }
        void mkdir(dirname(target), { recursive: true })
          .then(() =>
            pipeline(stream, createWriteStream(target, { flags: 'wx', mode: 0o644 }))
          )
          .then(() => zip.readEntry())
          .catch((error: unknown) => fail(error instanceof Error ? error : new Error(String(error))))
      })
    })

    zip.readEntry()
  })
}

/**
 * Extracts a hash-verified archive with explicit path, symlink, entry-count,
 * and size checks. Replaces extract-zip, which does not validate symlinks.
 */
export async function extractZip(zipPath: string, targetDirectory: string): Promise<void> {
  const zip = await openZip(zipPath)
  try {
    await extractEntries(zip, targetDirectory)
  } finally {
    zip.close()
  }
}
