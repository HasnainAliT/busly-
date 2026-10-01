import type { Actor } from '@/domain/engine'
import type { Role } from '@/types'
import { sanitizeText } from '@/utils/security'
import { LocalTransport } from './localTransport'
import { NETWORK_MESSAGE } from './apiTransport'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
  signedInAt: number
}

export class AuthError extends Error {
  code: 'invalid' | 'network' | 'locked' | 'duplicate'
  retryAfterSec?: number
  constructor(code: 'invalid' | 'network' | 'locked' | 'duplicate', message: string, retryAfterSec?: number) {
    super(message)
    this.code = code
    this.retryAfterSec = retryAfterSec
  }
}

export interface AuthService {
  readonly mode: 'local' | 'api'
  /** Session found at start-up (sessionStorage in local mode, the server cookie in API mode). */
  initial(): SessionUser | null
  login(email: string, password: string, name?: string): Promise<SessionUser>
  signup(name: string, email: string, password: string): Promise<SessionUser>
  logout(): Promise<void>
  updateName(name: string): Promise<SessionUser | null>
  /** Who is acting, for the local engine. The API derives this from the cookie instead. */
  actor(): Actor | null
  onUnauthorized: (() => void) | null
}

const SESSION_KEY = 'busly.session.v1'
export const SESSION_TTL_MS = 30 * 60 * 1000
const ROLES: Role[] = ['rider', 'driver', 'operator', 'admin']
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function nameFromEmail(email: string) {
  const base = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
  return sanitizeText(base.replace(/\b\w/g, (c) => c.toUpperCase()), 60) || 'Rider'
}

/* ------------------------------------------------------------------ *
 * Local (demo) auth. No passwords are checked: it exists so the whole product,
 * including the driver and operator consoles, can be explored without a server.
 * ------------------------------------------------------------------ */

export class LocalAuth implements AuthService {
  readonly mode = 'local' as const
  onUnauthorized: (() => void) | null = null
  private cache: SessionUser | null | undefined
  private transport: LocalTransport

  constructor(transport: LocalTransport) {
    this.transport = transport
  }

  private read(): SessionUser | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      if (!raw) return null
      const p = JSON.parse(raw) as Partial<SessionUser>
      if (typeof p.email !== 'string' || typeof p.name !== 'string' || typeof p.signedInAt !== 'number') return null
      if (Date.now() - p.signedInAt > SESSION_TTL_MS) return null
      const account = this.transport.findUser(p.email)
      const role = (account?.role ?? (ROLES.includes(p.role as Role) ? p.role : 'rider')) as Role
      return { id: account?.id ?? p.id ?? `u-${p.email}`, name: p.name, email: p.email, role, signedInAt: p.signedInAt }
    } catch {
      return null
    }
  }

  private write(user: SessionUser | null) {
    this.cache = user
    try {
      if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
      else sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* private mode: keep the in-memory session */
    }
  }

  initial() {
    this.cache = this.read()
    return this.cache
  }

  actor(): Actor | null {
    const u = this.cache === undefined ? this.read() : this.cache
    if (!u) return null
    // Re-read the role from the account every time so an admin's change applies without signing in again.
    const account = this.transport.findUser(u.email)
    if (account && !account.active) return null
    return { userId: account?.id ?? u.id, role: account?.role ?? u.role, name: u.name }
  }

  async login(email: string, _password: string, name?: string) {
    await wait(900)
    const e = email.trim().toLowerCase()
    // Prototype behaviour so reviewers can preview the failure states.
    if (e.startsWith('blocked@')) throw new AuthError('invalid', "That email and password don't match. Check them and try again.")
    if (e.startsWith('offline@')) throw new AuthError('network', NETWORK_MESSAGE)
    let account = this.transport.findUser(e)
    if (account && !account.active) throw new AuthError('invalid', 'This account has been deactivated. Ask an administrator.')
    if (!account) account = this.transport.registerRider(name ?? nameFromEmail(e), e)
    const user: SessionUser = { id: account.id, name: name ?? account.name, email: account.email, role: account.role, signedInAt: Date.now() }
    this.write(user)
    return user
  }

  async signup(name: string, email: string, _password: string) {
    await wait(1000)
    const e = email.trim().toLowerCase()
    if (this.transport.findUser(e)) throw new AuthError('duplicate', 'An account with that email already exists. Sign in instead.')
    const account = this.transport.registerRider(sanitizeText(name, 60), e)
    const user: SessionUser = { id: account.id, name: account.name, email: account.email, role: 'rider', signedInAt: Date.now() }
    this.write(user)
    return user
  }

  async logout() {
    this.write(null)
  }

  async updateName(name: string) {
    const u = this.cache ?? this.read()
    if (!u) return null
    const next = { ...u, name: sanitizeText(name, 60) }
    this.write(next)
    return next
  }

  /** Activity keeps the demo session alive, like a sliding server session. */
  touch() {
    const u = this.cache
    if (u) this.write({ ...u, signedInAt: Date.now() })
  }
}

/* ------------------------------------------------------------------ *
 * API auth: real passwords, HttpOnly cookie. The browser never holds a token.
 * ------------------------------------------------------------------ */

const HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'busly' }

export class ApiAuth implements AuthService {
  readonly mode = 'api' as const
  onUnauthorized: (() => void) | null = null
  private user: SessionUser | null = null
  private base: string

  constructor(base = '', restored: { id: string; name: string; email: string; role: Role } | null = null) {
    this.base = base
    this.user = restored ? { ...restored, signedInAt: Date.now() } : null
  }

  initial() {
    return this.user
  }

  actor(): Actor | null {
    return this.user ? { userId: this.user.id, role: this.user.role, name: this.user.name } : null
  }

  private async request(path: string, body: unknown): Promise<SessionUser> {
    let res: Response
    try {
      res = await fetch(`${this.base}${path}`, { method: 'POST', headers: HEADERS, credentials: 'same-origin', body: JSON.stringify(body) })
    } catch {
      throw new AuthError('network', NETWORK_MESSAGE)
    }
    const json = (await res.json().catch(() => ({}))) as { user?: Omit<SessionUser, 'signedInAt'>; code?: string; message?: string; retryAfterSec?: number }
    if (!res.ok || !json.user) {
      if (res.status === 429) throw new AuthError('locked', json.message ?? 'Too many attempts. Try again shortly.', json.retryAfterSec)
      if (res.status === 409) throw new AuthError('duplicate', json.message ?? 'That email is already registered.')
      throw new AuthError('invalid', json.message ?? "That email and password don't match. Check them and try again.")
    }
    this.user = { ...json.user, signedInAt: Date.now() }
    return this.user
  }

  login(email: string, password: string) {
    return this.request('/api/auth/login', { email, password })
  }

  signup(name: string, email: string, password: string) {
    return this.request('/api/auth/signup', { name, email, password })
  }

  async logout() {
    this.user = null
    try {
      await fetch(`${this.base}/api/auth/logout`, { method: 'POST', headers: HEADERS, credentials: 'same-origin', body: '{}' })
    } catch {
      /* the cookie expires on its own; the UI is already signed out */
    }
  }

  async updateName(name: string) {
    if (!this.user) return null
    this.user = { ...this.user, name: sanitizeText(name, 60) }
    return this.user
  }
}
