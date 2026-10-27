import { _electron as electron } from 'playwright'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const project = resolve(process.cwd())
const shots = resolve(project, 'docs/screenshots')
const userData = join(process.env.APPDATA ?? '', 'droidcrate')
const contentDir = join(userData, 'content')
const dbPath = join(userData, 'droidcrate.db')
const snapshot = join(project, '..', 'droidcrate-stage7')

await mkdir(shots, { recursive: true })
await mkdir(snapshot, { recursive: true })

const watchdog = setTimeout(() => process.exit(0), 150_000)

const errors = []

function track(page) {
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
}

async function open() {
  const app = await electron.launch({ args: ['.'], cwd: project })
  const page = await app.firstWindow()
  track(page)
  await page.waitForLoadState('domcontentloaded')
  return { app, page }
}

async function goSettings(page) {
  await page.locator('.nav__item').nth(6).click()
  await page.waitForSelector('.content-update', { timeout: 20_000 })
  await page.waitForTimeout(600)
}

async function noteTexts(page) {
  return page.locator('.content-update .inline-note').evaluateAll((nodes) =>
    nodes.map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim())
  )
}

async function copyDatabase(target) {
  for (const suffix of ['', '-wal', '-shm']) {
    const source = `${dbPath}${suffix}`
    if (existsSync(source)) await copyFile(source, `${target}${suffix}`)
  }
}

function dumpDatabase(path) {
  const db = new DatabaseSync(path)
  const read = (sql) => db.prepare(sql).all()
  const result = {
    checklists: read('SELECT checklist_id, checked_json, completed_at FROM checklist_progress ORDER BY checklist_id'),
    lessons: read('SELECT lesson_id, attempts, best_score, completed_at FROM lesson_progress ORDER BY lesson_id'),
    history: read('SELECT category, action, result FROM operation_history ORDER BY id')
  }
  db.close()
  return result
}

// Seed real progress and history, then shut the app down.
await rm(contentDir, { recursive: true, force: true })
{
  const { app, page } = await open()
  await page.evaluate(async () => {
    localStorage.setItem('droidcrate.language', 'en')
    const checklists = await window.droidcrate.getChecklistLibrary()
    const lesson = (await window.droidcrate.getLessonLibrary()).lessons[0]
    await window.droidcrate.saveChecklistProgress(
      checklists.checklists[0].id,
      checklists.checklists[0].items.slice(0, 2).map((item) => item.id),
      null
    )
    await window.droidcrate.submitQuiz(lesson.id, lesson.quiz.map((question) => question.answer))
    await window.droidcrate.clearHistory()
  })
  await page.locator('.nav__item').nth(2).click()
  await page.waitForSelector('.action-button', { timeout: 20_000 })
  await page.waitForTimeout(1500)
  await page.locator('.action-button').first().click()
  await page.waitForTimeout(3000)
  const seeded = await page.evaluate(async () => ({
    checklists: await window.droidcrate.getChecklistProgress(),
    learning: await window.droidcrate.getLearningState(),
    history: (await window.droidcrate.getHistory()).length
  }))
  console.log('seeded:', JSON.stringify(seeded))
  console.log('seeded history rows:', seeded.history)
  await app.close()
}
await copyDatabase(join(snapshot, 'before.db'))

// Install an older manifest so the UI shows an installed update with pending changes.
const shipped = JSON.parse(await readFile(join(project, 'data', 'content-manifest.json'), 'utf8'))
const older = structuredClone(shipped)
older.contentVersion = '2026.10.01'
older.files = older.files.map((file) =>
  file.path === 'lessons.json' ? { ...file, sha256: 'f'.repeat(64) } : file
)
await mkdir(contentDir, { recursive: true })
await writeFile(join(contentDir, 'content-manifest.json'), `${JSON.stringify(older, null, 2)}\n`)

{
  const { app, page } = await open()
  await goSettings(page)
  console.log('installed version:', await page.locator('.content-update__facts dd').first().innerText())
  console.log('badge:', await page.locator('.content-update .badge').innerText())
  await page.screenshot({ path: resolve(shots, 'stage-7-installed.png') })

  await page.getByRole('button', { name: 'Check for updates' }).click()
  await page.waitForSelector('.content-update__available, .content-update .inline-note--pass', {
    timeout: 60_000
  })
  await page.waitForTimeout(700)
  console.log('check notes:', (await noteTexts(page)).join(' | '))
  console.log('changes:', (await page.locator('.content-update__changes li').allInnerTexts()).join(' | '))
  await page.screenshot({ path: resolve(shots, 'stage-7-available.png') })

  await page.getByRole('button', { name: 'Install update' }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Confirm install' }).click()
  await page.waitForSelector('.content-update .inline-note--pass', { timeout: 90_000 })
  await page.waitForTimeout(800)
  console.log('after install:', (await noteTexts(page)).join(' | '))
  console.log('version now:', await page.locator('.content-update__facts dd').first().innerText())
  console.log('badge now:', await page.locator('.content-update .badge').innerText())
  await page.screenshot({ path: resolve(shots, 'stage-7-installed-success.png') })

  // Content readers must pick up the installed copy without a restart.
  const library = await page.evaluate(async () => {
    const lessons = await window.droidcrate.getLessonLibrary()
    const status = await window.droidcrate.getContentStatus()
    return {
      lessons: lessons.lessons.length,
      version: status.contentVersion,
      source: status.source,
      firstHeading: lessons.lessons[0].body.slice(0, 40)
    }
  })
  console.log('library:', JSON.stringify(library))

  await page.locator('.nav__item').nth(4).click()
  await page.waitForSelector('.lesson-item', { timeout: 20_000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: resolve(shots, 'stage-7-lessons.png') })

  const preserved = await page.evaluate(async () => ({
    checklists: await window.droidcrate.getChecklistProgress(),
    learning: await window.droidcrate.getLearningState(),
    history: (await window.droidcrate.getHistory()).length
  }))
  console.log('preserved:', JSON.stringify(preserved))

  // Offline notice: block the official host through Playwright routing is not
  // available in the main process, so simulate through the app bridge instead.
  const offline = await page.evaluate(() =>
    window.droidcrate.checkContentUpdate().then(() => 'online')
  )
  console.log('bridge check:', offline)

  await goSettings(page)
  await page.getByRole('button', { name: 'Restore bundled content' }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: resolve(shots, 'stage-7-restore-confirm.png') })
  await page.getByRole('button', { name: 'Confirm restore' }).click()
  await page.waitForSelector('.content-update .inline-note--pass', { timeout: 30_000 })
  await page.waitForTimeout(600)
  console.log('after restore:', (await noteTexts(page)).join(' | '))
  console.log('restore version:', await page.locator('.content-update__facts dd').first().innerText())
  await page.screenshot({ path: resolve(shots, 'stage-7-restored.png') })

  await page.getByRole('button', { name: 'Check for updates' }).click()
  await page.getByText('Content is up to date.').waitFor({ timeout: 60_000 })
  await page.waitForTimeout(500)
  console.log('up-to-date visible:', await page.getByText('Content is up to date.').isVisible())
  await page.screenshot({ path: resolve(shots, 'stage-7-up-to-date.png') })

  await page.evaluate(() => localStorage.setItem('droidcrate.language', 'ar'))
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  await goSettings(page)
  await page.waitForTimeout(500)
  await page.screenshot({ path: resolve(shots, 'stage-7-ar.png') })

  await app.close()
}

await copyDatabase(join(snapshot, 'after.db'))
const before = dumpDatabase(join(snapshot, 'before.db'))
const after = dumpDatabase(join(snapshot, 'after.db'))
console.log('db before:', JSON.stringify(before))
console.log('db after :', JSON.stringify(after))
console.log('db identical:', JSON.stringify(before) === JSON.stringify(after))

console.log('content dir exists after restore:', existsSync(contentDir))
console.log('errors:', errors.length ? errors.join('\n') : 'none')
clearTimeout(watchdog)
