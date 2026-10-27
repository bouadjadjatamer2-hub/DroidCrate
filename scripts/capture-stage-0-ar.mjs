import { _electron as electron } from 'playwright'
import { resolve } from 'node:path'

const project = resolve(process.cwd())
const app = await electron.launch({ args: ['.'], cwd: project })
const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Settings' }).click()
await page.getByRole('button', { name: 'العربية' }).click()
await page.waitForTimeout(500)
console.log('dir:', await page.evaluate(() => document.documentElement.dir))
console.log('lang:', await page.evaluate(() => document.documentElement.lang))
await page.screenshot({ path: resolve(project, 'docs/screenshots/stage-0-settings-ar.png') })
await page.getByRole('button', { name: 'الجهاز' }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: resolve(project, 'docs/screenshots/stage-0-device-ar.png') })
await app.close()
