import { _electron as electron } from 'playwright'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * End-to-end check of the application updater against a local generic feed.
 * It copies the packaged app, points app-update.yml at a throwaway HTTP
 * server that offers version 0.2.3 with a dummy installer, and drives the real
 * window: automatic prompt, "remind me later", "stay on this version", a
 * slowed download for a progress screenshot, and the ready-to-install state.
 *
 * The dummy installer is never executed; the app is quit before install.
 */
const project = resolve(process.cwd())
const unpacked = join(project, 'dist', 'win-unpacked')
const shots = join(project, 'docs', 'screenshots')
const root = join(tmpdir(), 'droidcrate-update-e2e')
const appRoot = join(root, 'app')
const profile = join(root, 'profile')
const size = 32 * 1024 * 1024
const dummy = Buffer.alloc(size, 0x5a)
const sha512 = createHash('sha512').update(dummy).digest('base64')
const latestYml = `version: 0.2.3
files:
  - url: DroidCrate-0.2.3-Setup.exe
    sha512: ${sha512}
    size: ${size}
path: DroidCrate-0.2.3-Setup.exe
sha512: ${sha512}
releaseDate: '2026-11-14T12:00:00.000Z'
releaseName: DroidCrate 0.2.3
releaseNotes: >-
  Faster update checks, a calmer download prompt, and Arabic release notes.
`

if (!existsSync(join(unpacked, 'droidcrate.exe'))) {
  throw new Error('Build the unpacked app first: npx electron-builder --win --dir')
}

await rm(root, { recursive: true, force: true })
await mkdir(profile, { recursive: true })
// A cached installer from an earlier run would make the download instant and
// hide the progress UI.
if (process.env.LOCALAPPDATA) {
  await rm(join(process.env.LOCALAPPDATA, 'droidcrate-updater-e2e'), {
    recursive: true,
    force: true
  })
}
await cp(unpacked, appRoot, { recursive: true })

const server = createServer(async (request, response) => {
  const path = (request.url ?? '/').split('?')[0]
  if (path === '/latest.yml') {
    response.writeHead(200, { 'content-type': 'text/yaml', 'cache-control': 'no-store' })
    response.end(latestYml)
    return
  }
  if (path === '/DroidCrate-0.2.3-Setup.exe') {
    response.writeHead(200, {
      'content-type': 'application/octet-stream',
      'content-length': size,
      'cache-control': 'no-store'
    })
    const chunk = 128 * 1024
    for (let offset = 0; offset < size; offset += chunk) {
      const end = Math.min(offset + chunk, size)
      if (!response.write(dummy.subarray(offset, end))) await once(response, 'drain')
      await new Promise((done) => setTimeout(done, 40))
    }
    response.end()
    return
  }
  response.writeHead(404)
  response.end()
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const port = server.address().port

await writeFile(
  join(appRoot, 'resources', 'app-update.yml'),
  `provider: generic
url: http://127.0.0.1:${port}/
updaterCacheDirName: droidcrate-updater-e2e
`,
  'utf8'
)

const errors = []
let app
let page
let step = 'launch'
const log = (message) => console.log(`[${step}] ${message}`)

try {
  app = await electron.launch({
    executablePath: join(appRoot, 'droidcrate.exe'),
    args: [`--user-data-dir=${profile}`],
    env: { ...process.env },
    timeout: 90_000
  })
  app.process().stderr?.on('data', (data) => log(`main:err ${String(data).trim()}`))
  log(`launched pid ${app.process().pid}`)

  page = await app.firstWindow({ timeout: 45_000 })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })

  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => {
    localStorage.setItem(
      'droidcrate.welcome.v1',
      JSON.stringify({ version: 1, acceptedAt: new Date().toISOString() })
    )
    localStorage.setItem('droidcrate.language', 'en')
  })
  await page.reload()
  await page.waitForSelector('.shell', { timeout: 30_000 })
  log('shell ready')

  const state = () => page.evaluate(() => window.droidcrate.getUpdateState())
  const prefs = async () => {
    const userData = await app.evaluate(({ app }) => app.getPath('userData'))
    const raw = await readFile(join(userData, 'updates.json'), 'utf8').catch(() => '')
    return raw ? JSON.parse(raw) : null
  }

  step = 'available'
  // The updater checks shortly after launch; no button press needed.
  await page.waitForSelector('.update-modal', { timeout: 60_000 })
  await page.waitForTimeout(400)
  const available = { state: await state(), modal: await page.locator('.update-modal').innerText() }
  await page.screenshot({ path: join(shots, 'update-available.png') })
  log(`available ${available.state.availableVersion}, ${available.state.phase}`)

  step = 'later'
  await page.locator('.update-modal').getByRole('button', { name: 'Remind me later' }).click()
  await page.waitForSelector('.update-modal', { state: 'detached' })
  await page.waitForTimeout(400)
  const afterLater = { prefs: await prefs(), state: await state() }

  step = 'settings'
  await page.locator('.nav__item').nth(5).click()
  await page.waitForSelector('.settings-grid', { timeout: 20_000 })
  await page.locator('.settings-card', { hasText: 'Application update' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(250)
  await page.screenshot({ path: join(shots, 'update-settings.png') })
  await page.getByRole('button', { name: 'Check for app update' }).click()

  // A manual check clears the snooze and offers the update again.
  step = 'manual-after-snooze'
  await page.waitForSelector('.update-modal', { timeout: 60_000 })
  await page.waitForTimeout(300)
  const afterManual = { state: await state(), prefs: await prefs() }

  step = 'skip'
  await page.locator('.update-modal').getByRole('button', { name: 'Stay on this version' }).click()
  await page.waitForSelector('.update-modal', { state: 'detached' })
  await page.waitForTimeout(500)
  const afterSkip = { state: await state(), prefs: await prefs() }
  await page.screenshot({ path: join(shots, 'update-skipped.png') })

  // Manual check brings a skipped version back.
  step = 'manual-after-skip'
  await page.getByRole('button', { name: 'Check for app update' }).click()
  await page.waitForSelector('.update-modal', { timeout: 60_000 })
  await page.locator('.update-modal').getByRole('button', { name: 'Update now' }).click()

  step = 'downloading'
  await page.waitForSelector('.update-modal .update-progress', { timeout: 30_000 })
  const progressSamples = []
  const deadline = Date.now() + 120_000
  let downloading = await state()
  while (
    downloading.phase === 'downloading' &&
    (downloading.progress ?? 0) < 5 &&
    Date.now() < deadline
  ) {
    await new Promise((done) => setTimeout(done, 250))
    downloading = await state()
    progressSamples.push(`${downloading.phase}:${downloading.progress}:${downloading.transferred}`)
  }
  await page.waitForTimeout(100)
  downloading = await state()
  await page.screenshot({ path: join(shots, 'update-downloading.png') })
  log(`progress ${downloading.progress}% ${downloading.phase} (${progressSamples.length} samples)`)

  step = 'ready'
  await page.locator('.update-modal').getByRole('button', { name: 'Restart and install' }).waitFor({
    timeout: 120_000
  })
  await page.waitForTimeout(300)
  const ready = await state()
  await page.screenshot({ path: join(shots, 'update-ready.png') })
  log(`ready ${ready.phase} ${ready.progress}%`)

  step = 'ready-close'
  await page.locator('.update-modal').getByRole('button', { name: 'Later', exact: true }).click()
  await page.waitForSelector('.update-modal', { state: 'detached' })
  await page.waitForTimeout(300)
  const afterReadyClose = { state: await state(), running: app.windows().length > 0 }

  console.log(
    JSON.stringify(
      {
        feed: `http://127.0.0.1:${port}/`,
        available,
        afterLater,
        afterManual,
        afterSkip,
        downloading,
        progressSamples,
        ready,
        afterReadyClose,
        errors
      },
      null,
      2
    )
  )
} catch (error) {
  console.log(`FAILED at ${step}`)
  console.log(error instanceof Error ? error.stack : String(error))
  if (page) {
    try {
      console.log('state at failure', JSON.stringify(await page.evaluate(() => window.droidcrate.getUpdateState())))
      await page.screenshot({ path: join(shots, 'update-failure.png') })
    } catch {
      // Window may already be gone.
    }
  }
  process.exitCode = 1
} finally {
  if (app) {
    const closed = await Promise.race([
      app.close().then(() => 'closed'),
      new Promise((done) => setTimeout(() => done('timeout'), 10_000))
    ])
    if (closed !== 'closed') app.process().kill('SIGKILL')
  }
  server.close()
  await rm(root, { recursive: true, force: true }).catch(() => undefined)
}
