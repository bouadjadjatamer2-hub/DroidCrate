import { _electron as electron } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const project = resolve(process.cwd())
const shots = resolve(project, 'docs/screenshots')
await mkdir(shots, { recursive: true })

const watchdog = setTimeout(() => process.exit(0), 60_000)

const app = await electron.launch({ args: ['.'], cwd: project })
const page = await app.firstWindow()
const errors = []
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})

async function openLessons() {
  await page.locator('.nav__item').nth(4).click()
  await page.waitForSelector('.lesson-item', { timeout: 20_000 })
}

await page.waitForLoadState('domcontentloaded')
await page.evaluate(() => localStorage.setItem('droidcrate.language', 'en'))
await page.reload()
await openLessons()
await page.waitForTimeout(600)

console.log('lessons:', await page.locator('.lesson-item').count())
console.log('reader:', await page.locator('.lesson-reader__head h2').innerText())
await page.screenshot({ path: resolve(shots, 'stage-5-lessons.png') })

// A completed lesson from earlier runs should survive in SQLite; pick the first.
const first = page.locator('.lesson-item').first()
console.log('first status:', (await first.innerText()).replaceAll('\n', ' | '))

const questions = page.locator('.quiz-question')
const answers = [2, 1, 1]
for (let index = 0; index < 3; index += 1) {
  await questions.nth(index).locator('input').nth(answers[index]).check()
}
await page.getByRole('button', { name: 'Check answers' }).click()
await page.waitForSelector('.quiz-result', { timeout: 20_000 })
await page.waitForTimeout(500)
console.log('result:', (await page.locator('.quiz-result').innerText()).replaceAll('\n', ' | '))
await page.locator('.quiz-result').scrollIntoViewIfNeeded()
await page.waitForTimeout(400)
await page.screenshot({ path: resolve(shots, 'stage-5-quiz.png') })

await page.reload()
await openLessons()
await page.waitForTimeout(800)
console.log('after reload:', (await page.locator('.lesson-item').first().innerText()).replaceAll('\n', ' | '))
console.log('sidebar:', (await page.locator('.lesson-nav__head').innerText()).replaceAll('\n', ' '))
await page.screenshot({ path: resolve(shots, 'stage-5-progress.png') })

await page.evaluate(() => localStorage.setItem('droidcrate.language', 'ar'))
await page.reload()
await openLessons()
await page.waitForTimeout(800)
console.log('arabic:', await page.locator('.lesson-reader__head h2').innerText())
await page.screenshot({ path: resolve(shots, 'stage-5-lessons-ar.png') })

console.log('errors:', errors.length ? errors.join('\n') : 'none')
clearTimeout(watchdog)
await app.close().catch(() => undefined)
