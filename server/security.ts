import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/* Password hashing: scrypt with a per-user random salt. Never store or log plain passwords. */
export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex')
  return { salt, hash }
}

export function verifyPassword(password: string, record: { salt: string; hash: string } | undefined): boolean {
  // Always do the work, even for unknown users, so response time doesn't reveal which emails exist.
  const salt = record?.salt ?? '00'.repeat(16)
  const expected = Buffer.from(record?.hash ?? '00'.repeat(64), 'hex')
  const actual = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
  return !!record && expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function passwordProblem(p: unknown): string | null {
  if (typeof p !== 'string' || p.length < 8) return 'Use at least 8 characters.'
  if (p.length > 128) return 'Use 128 characters or fewer.'
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Include at least one letter and one number.'
  return null
}

/* Session token: base64url(payload).HMAC. Payload holds only the user id and expiry. */
const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url')

export function signSession(secret: string, uid: string, ttlMs: number, now = Date.now()): string {
  const payload = b64(JSON.stringify({ uid, exp: now + ttlMs }))
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function readSession(secret: string, token: string | undefined, now = Date.now()): string | null {
  if (!token || token.length > 400) return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { uid?: unknown; exp?: unknown }
    if (typeof uid !== 'string' || typeof exp !== 'number' || exp < now) return null
    return uid
  } catch {
    return null
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

/* In-memory limiter. Good enough for one process; use Redis or the platform's limiter behind several. */
export class Limiter {
  private hits = new Map<string, { count: number; reset: number; lockedUntil: number }>()
  constructor(
    private max: number,
    private windowMs: number,
    private lockMs = 0,
  ) {}

  /** Returns ms to wait if blocked, otherwise 0 and records the hit. */
  take(key: string, now = Date.now()): number {
    const e = this.hits.get(key)
    if (e && e.lockedUntil > now) return e.lockedUntil - now
    if (!e || e.reset <= now) {
      this.hits.set(key, { count: 1, reset: now + this.windowMs, lockedUntil: 0 })
      return 0
    }
    e.count++
    if (e.count > this.max) {
      e.lockedUntil = now + (this.lockMs || this.windowMs)
      return e.lockedUntil - now
    }
    return 0
  }

  clear(key: string) {
    this.hits.delete(key)
  }

  sweep(now = Date.now()) {
    for (const [k, v] of this.hits) if (v.reset <= now && v.lockedUntil <= now) this.hits.delete(k)
  }
}
