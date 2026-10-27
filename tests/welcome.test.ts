import { describe, expect, it } from 'vitest'
import {
  WELCOME_NOTICE_VERSION,
  createWelcomeRecord,
  isWelcomeAccepted,
  parseWelcomeRecord
} from '@shared/welcome'

describe('welcome notice', () => {
  it('accepts only a complete record for the current notice', () => {
    const record = createWelcomeRecord(new Date('2026-10-27T10:00:00.000Z'))

    expect(record.version).toBe(WELCOME_NOTICE_VERSION)
    expect(record.acceptedAt).toBe('2026-10-27T10:00:00.000Z')
    expect(isWelcomeAccepted(JSON.stringify(record))).toBe(true)
  })

  it('rejects a missing, malformed, or hand-edited value', () => {
    expect(isWelcomeAccepted(null)).toBe(false)
    expect(isWelcomeAccepted('')).toBe(false)
    expect(isWelcomeAccepted('yes')).toBe(false)
    expect(isWelcomeAccepted('{')).toBe(false)
    expect(isWelcomeAccepted('[]')).toBe(false)
    expect(isWelcomeAccepted(JSON.stringify({ version: WELCOME_NOTICE_VERSION }))).toBe(false)
    expect(
      isWelcomeAccepted(
        JSON.stringify({ version: WELCOME_NOTICE_VERSION, acceptedAt: 'not-a-date' })
      )
    ).toBe(false)
  })

  it('rejects an acceptance from an older notice version', () => {
    const older = JSON.stringify({
      version: WELCOME_NOTICE_VERSION - 1,
      acceptedAt: '2026-01-01T00:00:00.000Z'
    })

    expect(isWelcomeAccepted(older)).toBe(false)
    expect(parseWelcomeRecord(older)).toBeNull()
  })
})
