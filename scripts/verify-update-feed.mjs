import { _electron as electron } from 'playwright'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * Smoke test of the production update feed: launches the packaged app with its
 * real app-update.yml (GitHub), waits for the startup check, and confirms the
 * app reports that it is up to date without any prompt or download.
 *
 * Run after `npm run build:win`, with network access:
 *   node scripts/verify-update-feed.mjs
 */
const project = resolve(process.cwd())
const unpacked = join(project, 'dist', 'win-unpacked')
const exe = join(unpacked, 'droidcrate.exe')

if (!existsSync(exe)) {
  throw new Error('Build the unpacked app first: npm run build:win')
}

const root = await mkdtemp(join(tmpdir(), 'droidcrate-feed-'))
const profile = join(root, 'profile')
await mkdir(profile, { recursive: true })

const errors = []
let app
let page
let step = 'launch'

try {
  app = await electron.launch({
    executablePath: exe,
    args: [`--user-data-dir=${profile}`],
    env: { ...process.env },
    timeout: 90_000
  })
  app.process().stderr?.on('data', (data) => {
    const line = String(data).trim()
    if (line) console.log(`[main:err] ${line}`)
  })

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

  step = 'startup-check'
  const deadline = Date.now() + 90_000
  const settled = (value) =>
    Boolean(value.checkedAt) && value.phase !== 'checking' && value.phase !== 'downloading'
  let state = await page.evaluate(() => window.droidcrate.getUpdateState())
  while (!settled(state) && Date.now() < deadline) {
    await page.waitForTimeout(500)
    state = await page.evaluate(() => window.droidcrate.getUpdateState())
  }

  step = 'settings-card'
  await page.locator('.nav__item').nth(5).click()
  await page.waitForSelector('.settings-grid', { timeout: 20_000 })
  const card = page.locator('.settings-card', { hasText: 'Application update' })
  await card.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  const cardText = await card.innerText()
  state = await page.evaluate(() => window.droidcrate.getUpdateState())

  step = 'assert'
  const modalOpen = (await page.locator('.update-modal').count()) > 0
  const ok =
    Boolean(state.checkedAt) &&
    (state.phase === 'up-to-date' || state.phase === 'idle') &&
    !state.error &&
    !modalOpen &&
    /latest version|up to date/i.test(cardText) &&
    errors.length === 0

  console.log(
    JSON.stringify(
      {
        executable: exe,
        feed: 'github:bouadjadjatamer2-hub/DroidCrate',
        currentVersion: state.currentVersion,
        phase: state.phase,
        checkedAt: state.checkedAt,
        error: state.error,
        modalOpen,
        cardText,
        errors,
        ok
      },
      null,
      2
    )
  )
  if (!ok) process.exitCode = 1
} catch (error) {
  console.log(`FAILED at ${step}`)
  console.log(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
} finally {
  if (app) {
    const closed = await Promise.race([
      app.close().then(() => 'closed'),
      new Promise((done) => setTimeout(() => done('timeout'), 10_000))
    ])
    if (closed !== 'closed') app.process().kill('SIGKILL')
  }
  await rm(root, { recursive: true, force: true }).catch(() => undefined)
}
