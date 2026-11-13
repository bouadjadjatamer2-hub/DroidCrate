import { _electron as electron } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

/**
 * Verifies the bilingual lessons in the real Electron window: Arabic body
 * direction, glossary in both languages, Arabic quiz feedback, and the English
 * fallback after switching the language back.
 */
const project = resolve(process.cwd())
const shots = resolve(project, 'docs/screenshots')
await mkdir(shots, { recursive: true })

const errors = []
const app = await electron.launch({ args: ['.'], cwd: project })
const page = await app.firstWindow()
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})

await app.evaluate(({ BrowserWindow }) => {
  const window = BrowserWindow.getAllWindows()[0]
  window.setSize(1280, 900)
})

await page.waitForLoadState('domcontentloaded')
await page.evaluate(() => {
  localStorage.setItem(
    'droidcrate.welcome.v1',
    JSON.stringify({ version: 1, acceptedAt: new Date().toISOString() })
  )
  localStorage.setItem('droidcrate.language', 'ar')
})
await page.reload()
await page.waitForSelector('.shell', { timeout: 20_000 })
await page.locator('.nav__item').nth(3).click()
await page.waitForSelector('.learning-layout', { timeout: 20_000 })
await page.waitForTimeout(400)

async function readLesson() {
  return page.evaluate(() => {
    const body = document.querySelector('.lesson-reader__body .markdown')
    const firstGlossary = document.querySelector('.glossary-item')
    return {
      title: document.querySelector('.lesson-reader__head h2')?.textContent?.trim() ?? '',
      summary: document.querySelector('.lesson-reader__head p')?.textContent?.trim() ?? '',
      bodyDir: body?.getAttribute('dir') ?? '',
      bodyStart: body?.textContent?.trim().slice(0, 90) ?? '',
      levelSummary: document.querySelector('.level-card__summary')?.textContent?.trim() ?? '',
      glossaryCount: document.querySelectorAll('.glossary-item').length,
      glossaryTerm: firstGlossary?.querySelector('.glossary-term')?.textContent?.trim() ?? '',
      glossaryAlt: firstGlossary?.querySelector('.glossary-term-alt')?.textContent?.trim() ?? '',
      glossaryArabic: firstGlossary?.querySelector('.glossary-meaning')?.textContent?.trim() ?? '',
      glossaryEnglish:
        firstGlossary?.querySelector('.glossary-meaning--alt')?.textContent?.trim() ?? '',
      prompt: document.querySelector('.quiz-question h4')?.textContent?.trim() ?? '',
      options: Array.from(document.querySelectorAll('.quiz-question'))[0]
        ? Array.from(
            document.querySelectorAll('.quiz-question')[0].querySelectorAll('.quiz-option span')
          ).map((node) => node.textContent?.trim() ?? '')
        : []
    }
  })
}

const arabic = await readLesson()
await page.screenshot({ path: resolve(shots, 'lessons-ar-overview.png') })

await page.locator('.lesson-glossary').scrollIntoViewIfNeeded()
await page.waitForTimeout(250)
await page.screenshot({ path: resolve(shots, 'lessons-ar-glossary.png') })

const questions = page.locator('.quiz-question')
const count = await questions.count()
for (let index = 0; index < count; index += 1) {
  await questions.nth(index).locator('.quiz-option input').nth(0).check()
}
await page.locator('.quiz-actions .button--primary').click()
await page.waitForSelector('.quiz-result', { timeout: 20_000 })
await page.waitForTimeout(250)
const arabicQuiz = await page.evaluate(() => ({
  result: document.querySelector('.quiz-result strong')?.textContent?.trim() ?? '',
  feedback: document.querySelector('.quiz-explanation')?.textContent?.trim() ?? '',
  correctLabel:
    document.querySelector('.quiz-explanation strong')?.textContent?.trim() ?? ''
}))
await page.screenshot({ path: resolve(shots, 'lessons-ar-quiz.png') })

await page.evaluate(() => localStorage.setItem('droidcrate.language', 'en'))
await page.reload()
await page.waitForSelector('.shell', { timeout: 20_000 })
await page.locator('.nav__item').nth(3).click()
await page.waitForSelector('.learning-layout', { timeout: 20_000 })
await page.waitForTimeout(400)
const english = await readLesson()
await page.screenshot({ path: resolve(shots, 'lessons-en.png') })

console.log(
  JSON.stringify(
    {
      arabic,
      arabicQuiz,
      english: {
        title: english.title,
        bodyDir: english.bodyDir,
        bodyStart: english.bodyStart,
        glossaryCount: english.glossaryCount,
        glossaryTerm: english.glossaryTerm,
        glossaryEnglish: english.glossaryEnglish
      },
      errors
    },
    null,
    2
  )
)

await app.close().catch(() => undefined)
