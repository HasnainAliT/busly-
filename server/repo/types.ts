import type session from 'express-session'
import type { TransitData } from '../../src/domain/types'

export interface Credential {
  salt: string
  hash: string
}

export type ActivityType = 'auth.signup' | 'auth.login' | 'auth.google' | 'auth.logout' | 'action'

export interface ActivityEntry {
  id: string
  userId: string
  userName: string
  type: ActivityType
  summary: string
  at: number
}

export interface FavoriteLists {
  bus: string[]
  route: string[]
  stop: string[]
}

/** Per-user saved data. Stored server-side so it follows the person across devices. */
export interface UserData {
  favorites: FavoriteLists
  recentSearches: { from: string; to: string }[]
  readNotifications: string[]
}

export const emptyUserData = (): UserData => ({ favorites: { bus: [], route: [], stop: [] }, recentSearches: [], readNotifications: [] })

/**
 * Storage boundary. `transit` is the in-memory working copy the engine mutates; `save()` persists it.
 * Two implementations: FileRepo (zero setup, local development) and MongoRepo (MongoDB Atlas).
 */
export interface Repo {
  readonly kind: 'file' | 'mongo'
  transit: TransitData
  save(): void
  getCredential(userId: string): Promise<Credential | undefined>
  setCredential(userId: string, c: Credential): Promise<void>
  findUserIdByGoogle(googleId: string): Promise<string | undefined>
  linkGoogle(userId: string, googleId: string): Promise<void>
  logActivity(entry: Omit<ActivityEntry, 'id'>): void
  listActivity(q: { userId?: string; limit: number }): Promise<ActivityEntry[]>
  getUserData(userId: string): Promise<UserData>
  putUserData(userId: string, data: UserData): Promise<UserData>
  /** Session store that survives restarts (Mongo) or undefined for the in-memory default. */
  sessionStore(): session.Store | undefined
  health(): Promise<{ ok: boolean; detail?: string }>
  flush(): Promise<void>
  close(): Promise<void>
}

const short = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '')
const ids = (v: unknown, max = 60) => (Array.isArray(v) ? [...new Set(v.map((x) => short(x, 40)).filter(Boolean))].slice(0, max) : [])

/** Validates and trims anything a client sends as saved data. Unknown fields are dropped. */
export function sanitizeUserData(input: unknown): UserData {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const f = (o.favorites && typeof o.favorites === 'object' ? o.favorites : {}) as Record<string, unknown>
  const recent = Array.isArray(o.recentSearches) ? o.recentSearches : []
  return {
    favorites: { bus: ids(f.bus), route: ids(f.route), stop: ids(f.stop) },
    recentSearches: recent
      .map((r) => ({ from: short((r as Record<string, unknown>)?.from, 40), to: short((r as Record<string, unknown>)?.to, 40) }))
      .filter((r) => r.from && r.to)
      .slice(0, 6),
    readNotifications: ids(o.readNotifications, 200),
  }
}
