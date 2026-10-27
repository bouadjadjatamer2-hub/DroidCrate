import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock3,
  GraduationCap,
  Loader2,
  RotateCcw,
  Trophy
} from 'lucide-react'
import type { Lesson, LessonLevelId, QuizResult } from '@shared/learning'
import { Markdown } from '../components/Markdown'
import { SectionHeader } from '../components/SectionHeader'
import { useLearning } from '../hooks/useLearning'
import { useI18n } from '../i18n'

const LEVEL_ORDER: LessonLevelId[] = ['basic', 'intermediate', 'advanced']

function passMark(total: number): number {
  return Math.ceil(total * 0.6)
}

export function LessonsScreen() {
  const { t } = useI18n()
  const { library, progress, loading, error, submitting, submitQuiz, resetLesson } = useLearning()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [result, setResult] = useState<QuizResult | null>(null)
  const [quizError, setQuizError] = useState<string | null>(null)

  const lessons = useMemo(() => library?.lessons ?? [], [library])
  const selected = lessons.find((lesson) => lesson.id === selectedId) ?? lessons[0] ?? null
  const levels = library?.levels ?? []

  const completedCount = lessons.filter((lesson) => progress[lesson.id]?.completedAt).length
  const overall = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0
  const selectedProgress = selected ? progress[selected.id] : undefined
  const selectedComplete = Boolean(selectedProgress?.completedAt)
  const allAnswered = selected
    ? selected.quiz.every((question) => answers[question.id] !== undefined)
    : false

  function selectLesson(lesson: Lesson): void {
    if (lesson.id === selected?.id) return
    setSelectedId(lesson.id)
    setAnswers({})
    setResult(null)
    setQuizError(null)
    document.querySelector('.main')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function choose(questionId: string, optionIndex: number): void {
    setAnswers((current) => ({ ...current, [questionId]: optionIndex }))
    setResult(null)
    setQuizError(null)
  }

  async function checkAnswers(): Promise<void> {
    if (!selected) return
    if (!allAnswered) {
      setQuizError(t('lessons.quiz.unanswered'))
      return
    }
    const submission = await submitQuiz(
      selected.id,
      selected.quiz.map((question) => answers[question.id])
    )
    if (!submission) {
      setQuizError(t('lessons.quiz.error'))
      return
    }
    setResult(submission)
    setQuizError(null)
  }

  async function resetSelected(): Promise<void> {
    if (!selected) return
    try {
      await resetLesson(selected.id)
      setAnswers({})
      setResult(null)
      setQuizError(null)
    } catch {
      setQuizError(t('lessons.quiz.error'))
    }
  }

  return (
    <div className="screen">
      <SectionHeader
        eyebrow={t('lessons.eyebrow')}
        title={t('lessons.title')}
        subtitle={t('lessons.subtitle')}
        aside={
          <div className="status-chip">
            <span
              className={`status-chip__dot${completedCount > 0 ? ' status-chip__dot--live' : ''}`}
              aria-hidden="true"
            />
            <span>{t('lessons.progress', { done: completedCount, total: lessons.length })}</span>
            <span className="status-chip__sep" aria-hidden="true" />
            <span className="status-chip__muted">{t('lessons.passMark')}</span>
          </div>
        }
      />

      {loading ? (
        <section className="panel empty-state">
          <div className="empty-state__icon">
            <Loader2 size={26} className="spin" aria-hidden="true" />
          </div>
          <h2>{t('lessons.loading')}</h2>
        </section>
      ) : null}

      {error && !library ? (
        <section className="panel empty-state">
          <div className="empty-state__icon">
            <AlertTriangle size={26} aria-hidden="true" />
          </div>
          <h2>{t('lessons.errorTitle')}</h2>
          <p>{error}</p>
        </section>
      ) : null}

      {library ? (
        <>
          <div className="level-grid">
            {LEVEL_ORDER.map((levelId) => {
              const level = levels.find((item) => item.id === levelId)
              const levelLessons = lessons.filter((lesson) => lesson.level === levelId)
              const done = levelLessons.filter((lesson) => progress[lesson.id]?.completedAt).length
              const pct = levelLessons.length > 0 ? Math.round((done / levelLessons.length) * 100) : 0
              return (
                <button
                  key={levelId}
                  type="button"
                  className="panel level-card level-card--button"
                  onClick={() => {
                    if (levelLessons[0]) selectLesson(levelLessons[0])
                  }}
                >
                  <span className="level-card__label">
                    {t(`lessons.level.${levelId}`)} · {t('lessons.progress', { done, total: levelLessons.length })}
                  </span>
                  <span className="level-card__value">{t('lessons.progressPct', { value: pct })}</span>
                  <div className="progress" aria-hidden="true">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  {level ? <span className="level-card__summary">{level.summary}</span> : null}
                </button>
              )
            })}
          </div>

          <div className="learning-layout">
            <aside className="panel lesson-nav">
              <div className="lesson-nav__head">
                <GraduationCap size={16} aria-hidden="true" />
                <span>{t('lessons.choose')}</span>
                <span className="badge badge--quiet">{overall}%</span>
              </div>

              {levels.map((level) => (
                <div className="lesson-group" key={level.id}>
                  <div className="lesson-group__head">
                    <span>{t(`lessons.level.${level.id}`)}</span>
                  </div>
                  {lessons
                    .filter((lesson) => lesson.level === level.id)
                    .map((lesson) => {
                      const entry = progress[lesson.id]
                      const isActive = lesson.id === selected?.id
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          className={`lesson-item${isActive ? ' is-active' : ''}`}
                          onClick={() => selectLesson(lesson)}
                          aria-current={isActive ? 'true' : undefined}
                        >
                          <span className="lesson-item__icon" aria-hidden="true">
                            {entry?.completedAt ? (
                              <CheckCircle2 size={14} />
                            ) : (
                              <Circle size={14} />
                            )}
                          </span>
                          <span className="lesson-item__copy">
                            <strong>{lesson.title}</strong>
                            <span>
                              <Clock3 size={11} aria-hidden="true" />
                              {t('lessons.minutes', { count: lesson.minutes })}
                              {entry ? (
                                <em>
                                  {entry.completedAt
                                    ? t('lessons.completed')
                                    : t('lessons.bestScore', {
                                        score: entry.bestScore,
                                        total: entry.total
                                      })}
                                </em>
                              ) : null}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                </div>
              ))}
            </aside>

            {selected ? (
              <article className="panel lesson-reader">
                <div className="lesson-reader__head">
                  <div>
                    <div className="eyebrow">
                      {t(`lessons.level.${selected.level}`)} ·{' '}
                      {t('lessons.minutes', { count: selected.minutes })}
                    </div>
                    <h2>{selected.title}</h2>
                    <p>{selected.summary}</p>
                  </div>
                  <div className="lesson-reader__status">
                    <span className={`badge${selectedComplete ? '' : ' badge--quiet'}`}>
                      {selectedComplete ? t('lessons.completed') : t('lessons.notStarted')}
                    </span>
                    {selectedProgress ? (
                      <button
                        type="button"
                        className="button button--ghost button--compact"
                        onClick={() => void resetSelected()}
                      >
                        <RotateCcw size={12} aria-hidden="true" />
                        {t('lessons.reset')}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="lesson-reader__body">
                  <Markdown source={selected.body} />
                </div>

                <section className="lesson-quiz">
                  <div className="lesson-quiz__head">
                    <div>
                      <div className="eyebrow">
                        <BookOpen size={12} aria-hidden="true" /> {t('lessons.quiz.title')}
                      </div>
                      <h3>{t('lessons.quiz.title')}</h3>
                      <p>{t('lessons.quiz.body')}</p>
                    </div>
                    <span className="badge badge--quiet">{t('lessons.quiz.saved')}</span>
                  </div>

                  {selected.quiz.map((question, index) => {
                    const review = result?.review.find((item) => item.questionId === question.id)
                    return (
                      <div className="quiz-question" key={question.id}>
                        <h4>
                          <span>{t('lessons.quiz.question', { current: index + 1, total: selected.quiz.length })}</span>
                          {question.prompt}
                        </h4>
                        <div className="quiz-options">
                          {question.options.map((option, optionIndex) => {
                            const chosen = answers[question.id] === optionIndex
                            const tone = review
                              ? optionIndex === review.answer
                                ? ' correct'
                                : chosen
                                  ? ' wrong'
                                  : ''
                              : chosen
                                ? ' chosen'
                                : ''
                            return (
                              <label
                                key={option}
                                className={`quiz-option${tone ? ` quiz-option--${tone.trim()}` : ''}`}
                              >
                                <input
                                  type="radio"
                                  name={`quiz-${question.id}`}
                                  checked={chosen}
                                  onChange={() => choose(question.id, optionIndex)}
                                  disabled={submitting !== null}
                                />
                                <span>{option}</span>
                                {tone === ' correct' ? (
                                  <CheckCircle2 size={14} aria-hidden="true" />
                                ) : null}
                              </label>
                            )
                          })}
                        </div>
                        {review ? (
                          <p
                            className={`quiz-explanation${review.correct ? ' quiz-explanation--pass' : ' quiz-explanation--fail'}`}
                          >
                            <strong>
                              {review.correct ? t('lessons.quiz.correct') : t('lessons.quiz.incorrect')}
                            </strong>
                            {' — '}
                            {review.explanation}
                          </p>
                        ) : null}
                      </div>
                    )
                  })}

                  {result ? (
                    <div className={`quiz-result${result.passed ? ' quiz-result--pass' : ' quiz-result--fail'}`}>
                      {result.passed ? (
                        <Trophy size={18} aria-hidden="true" />
                      ) : (
                        <AlertTriangle size={18} aria-hidden="true" />
                      )}
                      <div>
                        <strong>
                          {t(result.passed ? 'lessons.quiz.pass' : 'lessons.quiz.fail', {
                            score: result.score,
                            total: result.total
                          })}
                        </strong>
                        <span>
                          {t(result.passed ? 'lessons.quiz.passBody' : 'lessons.quiz.failBody', {
                            needed: passMark(result.total)
                          })}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="button button--ghost button--compact"
                        onClick={() => {
                          setAnswers({})
                          setResult(null)
                          setQuizError(null)
                        }}
                      >
                        <RotateCcw size={12} aria-hidden="true" />
                        {t('lessons.quiz.retry')}
                      </button>
                    </div>
                  ) : (
                    <div className="quiz-actions">
                      <button
                        type="button"
                        className="button button--primary"
                        onClick={() => void checkAnswers()}
                        disabled={submitting !== null}
                      >
                        {submitting ? (
                          <Loader2 size={14} className="spin" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 size={14} aria-hidden="true" />
                        )}
                        {t('lessons.quiz.submit')}
                      </button>
                      {selectedProgress ? (
                        <span className="quiz-actions__meta">
                          {t('lessons.bestScore', {
                            score: selectedProgress.bestScore,
                            total: selectedProgress.total
                          })}{' '}
                          · {t('lessons.attempts', { count: selectedProgress.attempts })}
                        </span>
                      ) : null}
                    </div>
                  )}

                  {quizError ? <p className="quiz-error">{quizError}</p> : null}
                </section>
              </article>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
