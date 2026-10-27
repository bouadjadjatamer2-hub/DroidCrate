/** Bump this when the legal notice changes and every user must re-accept. */
export const WELCOME_NOTICE_VERSION = 1

export const WELCOME_STORAGE_KEY = 'droidcrate.welcome.v1'

export interface WelcomeRecord {
  version: number
  acceptedAt: string
}

export function createWelcomeRecord(now: Date = new Date()): WelcomeRecord {
  return { version: WELCOME_NOTICE_VERSION, acceptedAt: now.toISOString() }
}

/**
 * Accepts only a record written by this application with the current notice
 * version. Anything else - a hand-edited value, an older notice, or a missing
 * key - shows the welcome screen again.
 */
export function parseWelcomeRecord(raw: string | null): WelcomeRecord | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const record = parsed as Record<string, unknown>
  if (record.version !== WELCOME_NOTICE_VERSION) return null
  if (typeof record.acceptedAt !== 'string') return null
  const acceptedAt = new Date(record.acceptedAt)
  if (Number.isNaN(acceptedAt.getTime())) return null
  return { version: record.version, acceptedAt: record.acceptedAt }
}

export function isWelcomeAccepted(raw: string | null): boolean {
  return parseWelcomeRecord(raw) !== null
}
