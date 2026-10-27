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
await page.evaluate(() => {
  localStorage.setItem('droidcrate.language', 'en')
  localStorage.removeItem('droidcrate.checklists.v1')
})
await page.reload()
await page.locator('.nav__item').nth(2).click()
await page.waitForSelector('.platform-card')
await page.waitForTimeout(400)
await page.screenshot({ path: resolve(shots, 'stage-4-install-before.png') })

console.log('initial:', await page.locator('.platform-card__head').innerText())

const recheck = page.getByRole('button', { name: 'Re-check installation' })
if (await recheck.isVisible().catch(() => false)) await recheck.click()
await page.waitForTimeout(500)

const installButton = page.getByRole('button', { name: /Install Platform Tools|Reinstall or update/ })
await installButton.click()
console.log('installation started')

await page.waitForFunction(
  () => document.querySelector('.platform-card__head .badge')?.textContent?.includes('Installed and verified'),
  undefined,
  { timeout: 180_000 }
)
console.log('installation:', await page.locator('.platform-card__head').innerText())
await page.waitForTimeout(800)
await page.screenshot({ path: resolve(shots, 'stage-4-installed.png') })

await page.getByRole('button', { name: 'ADB version' }).click()
await page.waitForSelector('.log-entry')
await page.waitForTimeout(500)
console.log('log:', await page.locator('.log-entry').first().innerText())

const devices = await page.locator('.device-pick').count()
console.log('devices:', devices)
if (devices > 0) console.log('device:', await page.locator('.device-pick').first().innerText())

await page.getByRole('button', { name: 'Device information' }).click()
await page.waitForTimeout(1200)
console.log('log entries:', await page.locator('.log-entry').count())
console.log('latest:', await page.locator('.log-entry').first().innerText())

await page.locator('.main').evaluate((element) => {
  element.scrollTop = element.scrollHeight
})
await page.waitForTimeout(500)
await page.screenshot({ path: resolve(shots, 'stage-4-command-log.png') })

await page.evaluate(() => localStorage.setItem('droidcrate.language', 'ar'))
await page.reload()
await page.locator('.nav__item').nth(2).click()
await page.waitForSelector('.platform-card')
await page.waitForTimeout(700)
await page.screenshot({ path: resolve(shots, 'stage-4-console-ar.png') })

console.log('arabic title:', await page.locator('.section-header h1').innerText())
console.log('logs:', logs.length ? logs.join('\n') : 'none')
await app.close()
