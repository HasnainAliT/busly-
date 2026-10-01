import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { StateCard } from '@/components/ui/states'
import { homeForRole } from '@/hooks/useDemoLogin'
import type { Role } from '@/types'

/**
 * Client-side route guard: keeps signed-out visitors out of the app UI and remembers where they were going.
 * IMPORTANT: this is UX only. Every private API call must be authorised on the server.
 */
export function ProtectedRoute() {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

/** Sends signed-in users away from login/signup. */
export function PublicOnlyRoute() {
  const { user } = useAuth()
  const location = useLocation()
  if (user) {
    // Only follow a redirect that stays inside the app, never an arbitrary URL.
    const from = (location.state as { from?: string } | null)?.from
    const ok = from && (from.startsWith('/app') || (from.startsWith('/driver') && user.role === 'driver') || (from.startsWith('/operator') && (user.role === 'operator' || user.role === 'admin')))
    return <Navigate to={ok ? from : user.role === 'rider' ? '/app' : homeForRole(user.role)} replace />
  }
  return <Outlet />
}

/** Role gate for UI sections. Real role enforcement belongs on the server. */
export function RequireRole({ role, children, fallback }: { role: Role | Role[]; children?: ReactNode; fallback?: ReactNode }) {
  const { user } = useAuth()
  const allowed = Array.isArray(role) ? role : [role]
  if (!user || !allowed.includes(user.role)) {
    return (
      <>
        {fallback ?? (
          <StateCard icon={<Lock />} title="You don't have access to this section" description="Your account doesn't have permission to see this section." />
        )}
      </>
    )
  }
  return <>{children ?? <Outlet />}</>
}
