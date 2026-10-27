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
await page.waitForLoadState('domcontentloaded')

try {
  await page.waitForFunction(
    () => {
      const text = document.body.innerText
      return text.includes('Connected now') || text.includes('USB scan failed')
    },
    { timeout: 25_000 }
  )
} catch {
  logs.push('timeout: device detection did not report a result')
}
await page.waitForTimeout(700)
await page.screenshot({ path: resolve(shots, 'stage-1-device.png') })

const summary = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.device-card')].map((card) => card.innerText)
  const chip = document.querySelector('.status-chip')?.textContent ?? ''
  return { chip, cards }
})
console.log('chip:', summary.chip)
console.log('cards:', JSON.stringify(summary.cards, null, 2))

await page.getByRole('button', { name: 'Settings' }).click()
await page.getByRole('button', { name: 'العربية' }).click()
await page.getByRole('button', { name: 'الجهاز' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: resolve(shots, 'stage-1-device-ar.png') })

console.log('body:', (await page.locator('body').innerText()).slice(0, 400))
console.log('logs:', logs.length ? logs.join('\n') : 'none')
await app.close()
