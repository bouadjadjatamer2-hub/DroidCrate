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
await page.getByRole('button', { name: 'Checklists' }).click()
await page.waitForSelector('.checklist-nav')
await page.waitForTimeout(300)
await page.screenshot({ path: resolve(shots, 'stage-3-checklists.png') })

await page.getByRole('button', { name: /Restore stock firmware/ }).click()
await page.waitForSelector('.modal')
await page.screenshot({ path: resolve(shots, 'stage-3-ownership.png') })

const gateBoxes = page.locator('.gate-check input')
await gateBoxes.nth(0).check()
await gateBoxes.nth(1).check()
await page.getByRole('button', { name: 'Open checklist' }).click()
await page.waitForSelector('.check-item')

const items = page.locator('.check-item input')
const itemCount = await items.count()
for (let index = 0; index < itemCount; index += 1) {
  await items.nth(index).check()
}
await page.waitForTimeout(200)
await page.getByRole('button', { name: 'Mark complete' }).click()
await page.waitForSelector('.completion')
await page.locator('.main').evaluate((element) => {
  element.scrollTop = 0
})
await page.waitForTimeout(300)
await page.screenshot({ path: resolve(shots, 'stage-3-completed.png') })

console.log('checklists:', await page.locator('.checklist-nav').count())
console.log('items:', itemCount)
console.log('completed:', await page.locator('.completion').innerText())

await page.getByRole('button', { name: 'Settings' }).click()
await page.getByRole('button', { name: 'العربية' }).click()
await page.getByRole('button', { name: 'قوائم التحقق' }).click()
await page.getByRole('button', { name: /Restore stock firmware/ }).click()
await page.waitForSelector('.modal')
const arBoxes = page.locator('.gate-check input')
await arBoxes.nth(0).check()
await arBoxes.nth(1).check()
await page.getByRole('button', { name: 'فتح القائمة' }).click()
await page.waitForSelector('.check-item')
await page.waitForTimeout(300)
await page.screenshot({ path: resolve(shots, 'stage-3-checklists-ar.png') })

console.log('arabic items:', await page.locator('.check-item').count())
console.log('logs:', logs.length ? logs.join('\n') : 'none')
await app.close()
