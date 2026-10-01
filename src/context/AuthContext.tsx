import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getAuthService, getLiveFeed } from '@/services/backend'
import { SESSION_TTL_MS, AuthError, type SessionUser } from '@/services/authService'
import { useToast } from '@/components/ui/toast'

/**
 * Auth is provided by a service chosen at start-up (see services/backend.ts):
 *  - API mode: real passwords checked by the server, session in an HttpOnly cookie. The browser holds no token.
 *  - Local mode: demo accounts, no passwords checked, session id in sessionStorage.
 * `role` here only decides what the UI shows. The server re-checks it on every request.
 */

export type { SessionUser }
export { AuthError, SESSION_TTL_MS }

interface AuthContextValue {
  user: SessionUser | null
  mode: 'local' | 'api'
  login: (email: string, password: string, name?: string) => Promise<SessionUser>
  signup: (name: string, email: string, password: string) => Promise<SessionUser>
  logout: () => void
  updateName: (name: string) => void
  /** Local mode only. In API mode the server cookie decides, so this is null. */
  sessionExpiresAt: number | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const service = getAuthService()
  const toast = useToast()
  const [user, setUser] = useState<SessionUser | null>(() => service.initial())

  const reconnect = () => getLiveFeed().reconnect()

  const login = useCallback(
    async (email: string, password: string, name?: string) => {
      const u = await service.login(email, password, name)
      setUser(u)
      reconnect()
      return u
    },
    [service],
  )

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      const u = await service.signup(name, email, password)
      setUser(u)
      reconnect()
      return u
    },
    [service],
  )

  const logout = useCallback(() => {
    void service.logout().then(reconnect)
    setUser(null)
  }, [service])

  const updateName = useCallback(
    (name: string) => {
      void service.updateName(name).then((u) => u && setUser(u))
    },
    [service],
  )

  // The server says the session is no longer valid (expired, or an admin deactivated the account).
  useEffect(() => {
    service.onUnauthorized = () => {
      setUser((current) => {
        if (current) toast({ title: 'You were signed out', description: 'Your session ended. Sign in again to continue.', tone: 'info' })
        return null
      })
      reconnect()
    }
    return () => {
      service.onUnauthorized = null
    }
  }, [service, toast])

  // Local demo sessions expire after 30 idle minutes, like a short server session would.
  useEffect(() => {
    if (!user || service.mode !== 'local') return
    const remaining = user.signedInAt + SESSION_TTL_MS - Date.now()
    if (remaining <= 0) {
      logout()
      return
    }
    const t = setTimeout(logout, remaining)
    return () => clearTimeout(t)
  }, [user, service, logout])

  const value = useMemo<AuthContextValue>(
    () => ({ user, mode: service.mode, login, signup, logout, updateName, sessionExpiresAt: user && service.mode === 'local' ? user.signedInAt + SESSION_TTL_MS : null }),
    [user, service, login, signup, logout, updateName],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
