import { _electron as electron } from 'playwright'
import { resolve } from 'node:path'

const project = resolve(process.cwd())
const executablePath = resolve(project, 'dist/win-unpacked/droidcrate.exe')

const app = await electron.launch({ executablePath })
const page = await app.firstWindow()
const errors = []
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
await page.waitForLoadState('domcontentloaded')
await page.waitForSelector('.shell, .welcome', { timeout: 30_000 })
await page.waitForTimeout(800)

console.log('packaged:', await app.evaluate(({ app }) => app.isPackaged))
console.log('path:', await app.evaluate(({ app }) => app.getAppPath()))
console.log('data dir:', await app.evaluate(({ app }) => app.getPath('userData')))

if (await page.locator('.welcome').count()) {
  console.log('welcome shown for this profile')
  await page.locator('.welcome__check input').nth(0).check()
  await page.locator('.welcome__check input').nth(1).check()
  await page.getByRole('button', { name: 'Enter the workbench' }).click()
  await page.waitForSelector('.shell')
}

const info = await page.evaluate(() => window.droidcrate.getAppInfo())
console.log('version/electron:', info.version, info.electron)
const status = await page.evaluate(() => window.droidcrate.getContentStatus())
console.log('content:', status.contentVersion, status.source, status.fileCount)

const tools = await page.evaluate(() => window.droidcrate.getToolLibrary())
const lessons = await page.evaluate(() => window.droidcrate.getLessonLibrary())
const checklists = await page.evaluate(() => window.droidcrate.getChecklistLibrary())
console.log('libraries:', tools.tools.length, lessons.lessons.length, checklists.checklists.length)

const adb = await page.evaluate(() => window.droidcrate.runAdbAction('adb-version', null))
console.log('adb:', adb.ok, adb.output.split('\n')[0])

await page.screenshot({ path: resolve(project, 'docs/screenshots/stage-8-packaged.png') })
await page.locator('.nav__item').nth(6).click()
await page.waitForSelector('.content-update', { timeout: 20_000 })
await page.waitForTimeout(600)
await page.screenshot({ path: resolve(project, 'docs/screenshots/stage-8-packaged-settings.png') })

console.log('errors:', errors.length ? errors.join('\n') : 'none')
await app.close().catch(() => undefined)
