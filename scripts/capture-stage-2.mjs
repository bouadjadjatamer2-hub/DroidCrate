import { _electron as electron } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const project = resolve(process.cwd())
const shots = resolve(project, 'docs/screenshots')
await mkdir(shots, { recursive: true })

const app = await electron.launch({ args: ['.'], cwd: project })
const page = await app.firstWindow()
const logs = []
page.on('console', (message) => logs.push(`${message.type()}: ${message.text()}`))
page.on('pageerror', (error) => logs.push(`pageerror: ${error.message}`))

await page.waitForLoadState('domcontentloaded')
await page.evaluate(() => localStorage.setItem('droidcrate.language', 'en'))
await page.reload()
await page.getByRole('button', { name: 'Tools' }).click()
await page.waitForSelector('.tool-card', { timeout: 15_000 })
await page.waitForTimeout(400)
await page.screenshot({ path: resolve(shots, 'stage-2-tools.png') })

console.log('cards:', await page.locator('.tool-card').count())
console.log('summary:', await page.locator('.library-summary').innerText())

const search = page.getByPlaceholder('Search tools, brands, or chipsets')
await search.fill('magisk')
await page.waitForTimeout(300)
console.log('magisk cards:', await page.locator('.tool-card').count())
await page.screenshot({ path: resolve(shots, 'stage-2-filter.png') })

await page.getByRole('button', { name: 'Reset filters' }).first().click()
await page.getByRole('button', { name: 'Settings' }).click()
await page.getByRole('button', { name: 'العربية' }).click()
await page.getByRole('button', { name: 'الأدوات' }).click()
await page.waitForSelector('.tool-card')
await page.waitForTimeout(400)
await page.screenshot({ path: resolve(shots, 'stage-2-tools-ar.png') })

console.log('arabic cards:', await page.locator('.tool-card').count())
console.log('logs:', logs.length ? logs.join('\n') : 'none')
await app.close()
