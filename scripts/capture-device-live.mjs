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

async function maskSerials() {
  // Never publish a real device serial in the documentation screenshots.
  const state = await page.evaluate(() => window.droidcrate.getDeviceState())
  const serials = state.devices
    .map((device) => device.serial)
    .filter((serial) => typeof serial === 'string' && serial.length >= 6)
  await page.evaluate((values) => {
    if (values.length === 0) return
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const nodes = []
    while (walker.nextNode()) nodes.push(walker.currentNode)
    for (const node of nodes) {
      let text = node.nodeValue ?? ''
      for (const value of values) text = text.split(value).join('••••••••')
      if (text !== node.nodeValue) node.nodeValue = text
    }
  }, serials)
}

async function settle() {
  await page.waitForLoadState('domcontentloaded')
  const accept = page.getByRole('button', { name: /Enter the workbench|دخول مساحة العمل/ })
  if (await accept.count()) await accept.first().click().catch(() => undefined)
  await page.waitForTimeout(900)
}

await page.evaluate(() => localStorage.setItem('droidcrate.language', 'en'))
await page.reload()
await settle()

try {
  await page.waitForSelector('.device-card', { timeout: 30_000 })
  await page.waitForFunction(
    () => document.body.innerText.includes('Android') && !document.body.innerText.includes('Reading the phone'),
    { timeout: 30_000 }
  )
} catch {
  logs.push('timeout: device card or specifications did not appear')
}
await page.waitForTimeout(600)
await maskSerials()
await page.screenshot({ path: resolve(shots, 'stage-1-device.png') })

await page.getByRole('button', { name: 'Workbench', exact: true }).click()
await page.waitForTimeout(1_200)
await maskSerials()
await page.screenshot({ path: resolve(shots, 'workbench-overview-en.png') })

await page.getByRole('button', { name: 'Settings' }).click()
await page.getByRole('button', { name: 'العربية' }).click()
await page.getByRole('button', { name: 'الجهاز' }).click()
await page.waitForTimeout(1_000)
await maskSerials()
await page.screenshot({ path: resolve(shots, 'stage-1-device-ar.png') })

await page.getByRole('button', { name: 'الورشة', exact: true }).click()
await page.waitForTimeout(1_200)
await maskSerials()
await page.screenshot({ path: resolve(shots, 'workbench-overview-ar.png') })

const summary = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.device-card')].map((card) => card.innerText)
  const chip = document.querySelector('.status-chip')?.textContent ?? ''
  return { chip, cards }
})
console.log('chip:', summary.chip)
console.log('cards:', JSON.stringify(summary.cards, null, 2))
console.log('logs:', logs.length ? logs.join('\n') : 'none')
await app.close()
