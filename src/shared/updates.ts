/**
 * State of the application updater (not the content updater). The renderer
 * only ever sees this shape; the download URL is fixed by the build.
 */
export type UpdatePhase =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'up-to-date'
  | 'error'

export interface UpdateState {
  phase: UpdatePhase
  /** False in development, where there is no published feed. */
  supported: boolean
  currentVersion: string
  availableVersion: string | null
  releaseName: string | null
  releaseNotes: string | null
  releaseDate: string | null
  /** 0-100 while downloading, otherwise null. */
  progress: number | null
  bytesPerSecond: number | null
  transferred: number | null
  total: number | null
  error: string | null
  checkedAt: string | null
  /** The owner chose "stay on this version"; hides the reminder for it. */
  skippedVersion: string | null
  /** "Remind me later" hides the prompt until this ISO timestamp. */
  snoozedUntil: string | null
}

export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
export const UPDATE_SNOOZE_MS = 24 * 60 * 60 * 1000
export const UPDATE_STARTUP_DELAY_MS = 5_000
