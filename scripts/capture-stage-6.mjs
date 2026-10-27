import { _electron as electron } from 'playwright'
import { mkdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const project = resolve(process.cwd())
const shots = resolve(project, 'docs/screenshots')
await mkdir(shots, { recursive: true })
const exportPath = join(tmpdir(), 'droidcrate-history-export.csv')

const watchdog = setTimeout(() => process.exit(0), 90_000)

const app = await electron.launch({ args: ['.'], cwd: project })
const page = await app.firstWindow()
const errors = []
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})

await page.waitForLoadState('domcontentloaded')
await page.evaluate(async () => {
  localStorage.setItem('droidcrate.language', 'en')
  await window.droidcrate.clearHistory()
})
await page.reload()
await page.waitForLoadState('domcontentloaded')

// Run two allow-listed ADB reads so history has real rows.
await page.locator('.nav__item').nth(2).click()
await page.waitForSelector('.action-button', { timeout: 20_000 })
await page.locator('.action-button').first().click()
await page.waitForTimeout(4000)

// Complete a checklist so history also contains a non-ADB operation.
await page.locator('.nav__item').nth(3).click()
await page.waitForSelector('.checklist-nav', { timeout: 20_000 })
await page.locator('.checklist-nav').first().click()
await page.waitForSelector('.modal')
const gateChecks = page.locator('.gate-check input')
await gateChecks.nth(0).check()
await gateChecks.nth(1).check()
await page.locator('.modal__actions .button--primary').click()
await page.waitForSelector('.check-item')
const items = page.locator('.check-item input')
const itemCount = await items.count()
for (let index = 0; index < itemCount; index += 1) {
  await items.nth(index).check()
}
await page.waitForTimeout(400)
await page.locator('.checklist-detail__actions .button--primary').click()
await page.waitForTimeout(1200)

await page.locator('.nav__item').nth(5).click()
await page.waitForSelector('.history-entry', { timeout: 20_000 })
await page.waitForTimeout(500)
console.log('entries:', await page.locator('.history-entry').count())
console.log('first:', (await page.locator('.history-entry').first().innerText()).replaceAll('\n', ' | '))
await page.screenshot({ path: resolve(shots, 'stage-6-history.png') })

// Open the first row and show its details.
await page.locator('.history-entry summary').first().click()
await page.waitForTimeout(300)
await page.screenshot({ path: resolve(shots, 'stage-6-detail.png') })

// Filter and search.
await page.locator('.history-search input').fill('version')
await page.waitForTimeout(400)
console.log('search results:', await page.locator('.history-entry').count())
await page.locator('.history-search input').fill('no-such-command')
await page.waitForTimeout(400)
console.log('empty filter:', await page.locator('.empty-state h2').innerText())
await page.locator('.history-search input').fill('')
await page.waitForTimeout(300)
await page.locator('.history-filters select').first().selectOption('checklist')
await page.waitForTimeout(300)
console.log('checklist filter:', await page.locator('.history-entry').count())
await page.screenshot({ path: resolve(shots, 'stage-6-filter.png') })
await page.locator('.history-filters select').first().selectOption('all')
await page.waitForTimeout(300)

// Export through a stubbed save dialog.
await app.evaluate(({ dialog }, filePath) => {
  dialog.showSaveDialog = async () => ({ canceled: false, filePath })
}, exportPath)
await page.getByRole('button', { name: 'Export CSV' }).click()
await page.waitForTimeout(1200)
console.log('notice:', await page.locator('.inline-note--pass').innerText())
await page.screenshot({ path: resolve(shots, 'stage-6-export.png') })
const csv = await readFile(exportPath, 'utf8')
console.log('csv header:', csv.split('\r\n')[0])
console.log('csv rows:', csv.trim().split('\r\n').length - 1)

// Arabic pass.
await page.evaluate(() => localStorage.setItem('droidcrate.language', 'ar'))
await page.reload()
await page.waitForLoadState('domcontentloaded')
await page.locator('.nav__item').nth(5).click()
await page.waitForSelector('.history-entry', { timeout: 20_000 })
await page.waitForTimeout(700)
await page.screenshot({ path: resolve(shots, 'stage-6-history-ar.png') })

await page.evaluate(async () => {
  await window.droidcrate.clearHistory()
  await window.droidcrate.resetChecklistProgress('stock-firmware')
  localStorage.setItem('droidcrate.language', 'en')
})

console.log('errors:', errors.length ? errors.join('\n') : 'none')
clearTimeout(watchdog)
await app.close().catch(() => undefined)
