import { _electron as electron } from 'playwright'
import { resolve } from 'node:path'

const project = resolve(process.cwd())
const app = await electron.launch({ args: ['.'], cwd: project })
const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(900)
const shots = resolve(project, 'docs/screenshots')
const { mkdir } = await import('node:fs/promises')
await mkdir(shots, { recursive: true })
await page.screenshot({ path: resolve(shots, 'stage-0-device.png') })
await page.getByRole('button', { name: 'Settings' }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: resolve(shots, 'stage-0-settings.png') })
console.log('title:', await page.title())
console.log('size:', await page.evaluate(() => ({ w: innerWidth, h: innerHeight })))
console.log('body text:', (await page.locator('body').innerText()).slice(0, 300))
await app.close()
