import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = 'data'
const core = ['tools.json', 'checklists.json', 'lessons.json', 'devices.json']
const lessonBodies = (await readdir(join(root, 'lessons')))
  .filter((file) => file.endsWith('.md'))
  .sort()
  .map((file) => `lessons/${file}`)

const paths = [...core, ...lessonBodies].sort()
const files = []

for (const path of paths) {
  const buffer = await readFile(join(root, path))
  files.push({
    path,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    bytes: buffer.byteLength
  })
}

const explicit = process.argv.find((argument) => argument.startsWith('--version='))?.slice(10)
const now = new Date()
const pad = (value) => String(value).padStart(2, '0')
const version =
  explicit ??
  `${now.getUTCFullYear()}.${pad(now.getUTCMonth() + 1)}.${pad(now.getUTCDate())}`

const manifest = {
  schemaVersion: 1,
  contentVersion: version,
  generatedAt: now.toISOString(),
  files
}

await writeFile(join(root, 'content-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Wrote ${files.length} files for content version ${version}.`)
