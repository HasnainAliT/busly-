import { useNavigate } from 'react-router-dom'
import { useCallback, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import type { Role } from '@/types'

export const demoAccounts: Record<Role, { email: string; name: string; home: string; label: string }> = {
  rider: { email: 'rider@busly.app', name: 'Demo Rider', home: '/app/map?bus=BUS-104', label: 'Passenger' },
  driver: { email: 'driver@busly.app', name: 'Imran Khoso', home: '/driver', label: 'Driver' },
  operator: { email: 'operator@busly.app', name: 'Omar Dispatcher', home: '/operator', label: 'Operator' },
  admin: { email: 'admin@busly.app', name: 'Amina Admin', home: '/operator', label: 'Administrator' },
}

/** Seeded demo accounts on the real server share this password. Change it (or remove the seed users) before a public deployment. */
export const DEMO_PASSWORD = 'Busly@2026'

export const homeForRole = (role: Role) => demoAccounts[role].home.split('?')[0]

/** One-tap demo entry for reviewers. Works in demo mode only; with a real server the password is checked. */
export function useDemoLogin(role: Role = 'rider', target?: string) {
  const { login, mode } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)

  const start = useCallback(async () => {
    setPending(true)
    try {
      const acct = demoAccounts[role]
      await login(acct.email, mode === 'api' ? DEMO_PASSWORD : '', acct.name)
      navigate(target ?? acct.home)
    } finally {
      setPending(false)
    }
  }, [login, mode, navigate, role, target])

  return { start, pending }
}
