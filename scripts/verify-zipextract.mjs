import { _electron as electron } from 'playwright'
import { resolve } from 'node:path'

const project = resolve(process.cwd())
const app = await electron.launch({ args: ['.'], cwd: project })
const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')

const before = await page.evaluate(() => window.droidcrate.getPlatformToolsStatus())
console.log('before:', before.stage, before.installed, before.version)

const started = Date.now()
const installed = await page.evaluate(() => window.droidcrate.installPlatformTools())
console.log('install ms:', Date.now() - started)
console.log('after:', JSON.stringify({
  stage: installed.stage,
  installed: installed.installed,
  version: installed.version,
  error: installed.error,
  path: installed.installPath
}))

const adb = await page.evaluate(() => window.droidcrate.runAdbAction('adb-version', null))
console.log('adb ok:', adb.ok, 'duration:', adb.durationMs)
console.log('adb summary:', (adb.output ?? '').split('\n')[0])
console.log('adb error:', adb.error)

await app.close().catch(() => undefined)

