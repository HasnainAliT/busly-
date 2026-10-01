import { ApiAuth, LocalAuth, type AuthService } from './authService'
import { ApiTransport } from './apiTransport'
import { LocalTransport } from './localTransport'
import { TransitStore, type LiveFeed } from './transitStore'
import type { Role } from '@/types'

/**
 * Picks the backend once at start-up.
 *  - If a Busly API answers at /api/health (npm run server, or the same host), use it.
 *  - Otherwise run the domain engine in the browser (local demo mode).
 * The UI only sees LiveFeed and AuthService, so it never knows which one it got.
 */

export interface Providers {
  google: boolean
}
let providers: Providers = { google: false }
/** Which sign-in methods the server offers. Local demo mode has no Google. */
export const getProviders = () => providers

let feed: LiveFeed | null = null
let auth: AuthService | null = null

function activateLocal() {
  const holder: { auth: LocalAuth | null } = { auth: null }
  const transport = new LocalTransport(() => holder.auth?.actor() ?? null)
  holder.auth = new LocalAuth(transport)
  auth = holder.auth
  feed = new TransitStore(transport, 900)
}

function activateApi(restored: { id: string; name: string; email: string; role: Role } | null) {
  const transport = new ApiTransport()
  const apiAuth = new ApiAuth('', restored)
  transport.onUnauthorized = () => apiAuth.onUnauthorized?.()
  auth = apiAuth
  feed = new TransitStore(transport, 0)
}

export function getLiveFeed(): LiveFeed {
  if (!feed) activateLocal()
  return feed as LiveFeed
}

export function getAuthService(): AuthService {
  if (!auth) activateLocal()
  return auth as AuthService
}

/** Run before the first render. Resolves quickly and never throws. */
export async function bootstrapBackend(timeoutMs = 1500): Promise<'api' | 'local'> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch('/api/health', { signal: ctrl.signal, credentials: 'same-origin' })
    clearTimeout(timer)
    const json = (await res.json()) as { app?: string }
    if (json.app === 'busly') {
      let restored = null
      try {
        const me = await fetch('/api/auth/me', { credentials: 'same-origin' })
        restored = ((await me.json()) as { user: { id: string; name: string; email: string; role: Role } | null }).user
      } catch {
        /* treated as signed out */
      }
      try {
        const pr = await fetch('/api/auth/providers', { credentials: 'same-origin' })
        providers = { google: !!((await pr.json()) as { google?: boolean }).google }
      } catch {
        /* Google stays hidden-as-unavailable */
      }
      activateApi(restored)
      return 'api'
    }
  } catch {
    /* no API: fall through to local mode */
  }
  activateLocal()
  return 'local'
}

/** Test helper: start from a clean local backend. */
export function resetBackendForTests() {
  feed = null
  auth = null
}
