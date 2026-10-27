import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LessonLibrary, LessonProgress, QuizResult } from '@shared/learning'

interface LearningHook {
  library: LessonLibrary | null
  progress: Record<string, LessonProgress>
  loading: boolean
  error: string | null
  submitting: string | null
  submitQuiz: (lessonId: string, answers: number[]) => Promise<QuizResult | null>
  resetLesson: (lessonId: string) => Promise<void>
}

export function useLearning(): LearningHook {
  const [library, setLibrary] = useState<LessonLibrary | null>(null)
  const [progress, setProgress] = useState<Record<string, LessonProgress>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([window.droidcrate.getLessonLibrary(), window.droidcrate.getLearningState()])
      .then(([catalog, state]) => {
        if (cancelled) return
        setLibrary(catalog)
        setProgress(Object.fromEntries(state.progress.map((entry) => [entry.lessonId, entry])))
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Learning content unavailable')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const submitQuiz = useCallback(
    async (lessonId: string, answers: number[]): Promise<QuizResult | null> => {
      setSubmitting(lessonId)
      setError(null)
      try {
        const result = await window.droidcrate.submitQuiz(lessonId, answers)
        setProgress((current) => ({ ...current, [result.lessonId]: result.progress }))
        return result
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Quiz could not be saved')
        return null
      } finally {
        setSubmitting(null)
      }
    },
    []
  )

  const resetLesson = useCallback(async (lessonId: string): Promise<void> => {
    await window.droidcrate.resetLessonProgress(lessonId)
    setProgress((current) => {
      const next = { ...current }
      delete next[lessonId]
      return next
    })
  }, [])

  const progressMap = useMemo(
    () => Object.fromEntries(Object.entries(progress).map(([id, entry]) => [id, entry])),
    [progress]
  )

  return {
    library,
    progress: progressMap,
    loading,
    error,
    submitting,
    submitQuiz,
    resetLesson
  }
}
