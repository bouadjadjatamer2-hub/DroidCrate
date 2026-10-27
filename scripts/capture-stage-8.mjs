import { _electron as electron } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const project = resolve(process.cwd())
const shots = resolve(project, 'docs/screenshots')
await mkdir(shots, { recursive: true })

const watchdog = setTimeout(() => process.exit(0), 120_000)
const errors = []

const app = await electron.launch({ args: ['.'], cwd: project })
const page = await app.firstWindow()
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})

await page.waitForLoadState('domcontentloaded')
await page.evaluate(() => {
  localStorage.removeItem('droidcrate.welcome.v1')
  localStorage.setItem('droidcrate.language', 'en')
})
await page.reload()
await page.waitForLoadState('domcontentloaded')
await page.waitForSelector('.welcome', { timeout: 20_000 })
await page.waitForTimeout(500)

console.log('accept disabled:', await page.getByRole('button', { name: 'Enter the workbench' }).isDisabled())
await page.locator('.welcome__check input').nth(0).check()
console.log('still disabled after one box:', await page.getByRole('button', { name: 'Enter the workbench' }).isDisabled())
await page.locator('.welcome__check input').nth(1).check()
await page.waitForTimeout(300)
await page.screenshot({ path: resolve(shots, 'stage-8-welcome.png') })

await page.getByRole('button', { name: 'Enter the workbench' }).click()
await page.waitForSelector('.shell', { timeout: 20_000 })
const stored = await page.evaluate(() => localStorage.getItem('droidcrate.welcome.v1'))
console.log('stored record:', stored)

await page.reload()
await page.waitForLoadState('domcontentloaded')
await page.waitForSelector('.shell', { timeout: 20_000 })
console.log('welcome count after reload:', await page.locator('.welcome').count())

// Settings can bring the notice back.
await page.locator('.nav__item').nth(6).click()
await page.waitForSelector('.settings-grid', { timeout: 20_000 })
await page.getByRole('button', { name: 'Show start notice again' }).click()
await page.waitForSelector('.welcome', { timeout: 20_000 })
await page.waitForTimeout(400)
console.log('notice restored from settings:', await page.locator('.welcome').isVisible())

// Arabic pass.
await page.evaluate(() => localStorage.setItem('droidcrate.language', 'ar'))
await page.reload()
await page.waitForLoadState('domcontentloaded')
await page.waitForSelector('.welcome', { timeout: 20_000 })
await page.waitForTimeout(500)
await page.screenshot({ path: resolve(shots, 'stage-8-welcome-ar.png') })
console.log('arabic title:', await page.locator('.welcome__head h1').innerText())

// Leave the profile in a normal, accepted English state.
await page.evaluate(() => {
  localStorage.setItem('droidcrate.language', 'en')
  localStorage.removeItem('droidcrate.welcome.v1')
})
await page.reload()
await page.waitForLoadState('domcontentloaded')
await page.waitForSelector('.welcome', { timeout: 20_000 })
await page.locator('.welcome__check input').nth(0).check()
await page.locator('.welcome__check input').nth(1).check()
await page.getByRole('button', { name: 'Enter the workbench' }).click()
await page.waitForSelector('.shell', { timeout: 20_000 })

console.log('errors:', errors.length ? errors.join('\n') : 'none')
clearTimeout(watchdog)
await app.close().catch(() => undefined)
