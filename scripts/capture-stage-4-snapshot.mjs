import { _electron as electron } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const project = resolve(process.cwd())
const shots = resolve(project, 'docs/screenshots')
await mkdir(shots, { recursive: true })

// Never let a slow window teardown keep the capture alive.
const watchdog = setTimeout(() => process.exit(0), 45_000)

const app = await electron.launch({ args: ['.'], cwd: project })
const page = await app.firstWindow()
const logs = []
page.on('console', (message) => logs.push(`${message.type()}: ${message.text()}`))
page.on('pageerror', (error) => logs.push(`pageerror: ${error.message}`))

await page.waitForLoadState('domcontentloaded')
await page.evaluate(() => localStorage.setItem('droidcrate.language', 'en'))
await page.reload()
await page.locator('.nav__item').nth(2).click()
await page.waitForSelector('.platform-card')

await page.waitForFunction(
  () => document.querySelectorAll('.device-pick').length > 0,
  undefined,
  { timeout: 20_000 }
)

await page.getByRole('button', { name: 'Device information' }).click()
await page.waitForSelector('.adb-snapshot', { timeout: 20_000 })
await page.waitForTimeout(600)
console.log('snapshot:', await page.locator('.adb-snapshot').innerText())

await page.locator('.adb-grid').scrollIntoViewIfNeeded()
await page.waitForTimeout(400)
await page.screenshot({ path: resolve(shots, 'stage-4-device-snapshot.png') })

console.log('logs:', logs.length ? logs.join('\n') : 'none')
clearTimeout(watchdog)
await app.close().catch(() => undefined)
