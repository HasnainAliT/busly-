import { BUS_ID_PATTERN, knownBusIds } from '@/data/mockBuses'

/* ------------------------------------------------------------------ *
 * Input validation. These checks improve UX only; the backend must
 * re-validate every field because client code can be bypassed.
 * ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/

export function validateEmail(value: string): string | null {
  const v = value.trim()
  if (!v) return 'Enter your email address.'
  if (v.length > 254 || !EMAIL_RE.test(v)) return 'Enter a valid email address.'
  return null
}

export function validatePassword(value: string): string | null {
  if (!value) return 'Enter a password.'
  if (value.length < 8) return 'Use at least 8 characters.'
  if (value.length > 128) return 'Use 128 characters or fewer.'
  return null
}

export function validateStrongPassword(value: string): string | null {
  const base = validatePassword(value)
  if (base) return base
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return 'Include at least one letter and one number.'
  return null
}

export function validateName(value: string): string | null {
  const v = value.trim()
  if (v.length < 2) return 'Enter your name.'
  if (v.length > 60) return 'Use 60 characters or fewer.'
  return null
}

export function passwordStrength(value: string): 0 | 1 | 2 | 3 {
  let score = 0
  if (value.length >= 8) score++
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++
  return score as 0 | 1 | 2 | 3
}

/* ------------------------------------------------------------------ *
 * Text sanitising. React already escapes text nodes; this additionally
 * strips control characters and bidi overrides from user-generated text
 * before it is stored or shown, and we never use dangerouslySetInnerHTML.
 * ------------------------------------------------------------------ */

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g

export function sanitizeText(input: string, maxLength = 280): string {
  return input.replace(CONTROL_CHARS, '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

/* ------------------------------------------------------------------ *
 * Safe tracking links / QR payloads. Only same-origin /track/BUS-xxx
 * links (or the busly://bus/BUS-xxx scheme) are accepted, and the bus id
 * must match a strict pattern AND exist in our data before we navigate.
 * ------------------------------------------------------------------ */

export type QrParseResult = { ok: true; busId: string } | { ok: false; reason: string }

export function buildTrackingUrl(busId: string): string {
  if (!BUS_ID_PATTERN.test(busId)) throw new Error('Invalid bus id')
  return `${window.location.origin}/track/${busId}`
}

export function parseTrackingPayload(raw: string): QrParseResult {
  const text = raw.trim()
  if (!text || text.length > 300) return { ok: false, reason: 'This code is empty or too long to be a Busly code.' }

  let candidate: string | null = null
  const scheme = /^busly:\/\/bus\/([A-Z]+-\d{3})$/.exec(text)
  if (scheme) {
    candidate = scheme[1]
  } else {
    try {
      const url = new URL(text)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol')
      if (url.origin !== window.location.origin) return { ok: false, reason: 'This code points to another website, so Busly will not open it.' }
      const match = /^\/track\/([A-Z]+-\d{3})\/?$/.exec(url.pathname)
      if (!match) throw new Error('path')
      candidate = match[1]
    } catch {
      return { ok: false, reason: 'This is not a Busly tracking code.' }
    }
  }

  if (!BUS_ID_PATTERN.test(candidate) || !knownBusIds.includes(candidate)) {
    return { ok: false, reason: `We couldn't find ${candidate.slice(0, 12)} in the active fleet.` }
  }
  return { ok: true, busId: candidate }
}

/* ------------------------------------------------------------------ *
 * Mock client-side rate limiter for auth flows. Real throttling must
 * happen on the server (per IP and per account); this only demonstrates
 * the UX of a lockout.
 * ------------------------------------------------------------------ */

export interface LimiterState {
  failures: number
  lockedUntil: number
}

export const MAX_ATTEMPTS = 5
export const LOCKOUT_MS = 30_000

export function registerFailure(state: LimiterState, now = Date.now()): LimiterState {
  const failures = state.failures + 1
  return failures >= MAX_ATTEMPTS ? { failures: 0, lockedUntil: now + LOCKOUT_MS } : { failures, lockedUntil: state.lockedUntil }
}

export const isLocked = (state: LimiterState, now = Date.now()) => state.lockedUntil > now
