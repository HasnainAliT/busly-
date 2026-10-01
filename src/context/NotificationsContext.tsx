import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createInitialNotifications } from '@/data/mockNotifications'
import { useFeedEvents } from '@/hooks/useLiveFeed'
import { useUserData } from '@/context/UserDataContext'
import { useToast } from '@/components/ui/toast'
import type { AppNotification, NotificationKind, ServiceAlert } from '@/types'
import { routeById, stops } from '@/data/mockRoutes'
import { getBusInsight } from '@/utils/bus'
import { getLiveFeed } from '@/services/liveFeed'

interface NotificationsValue {
  notifications: AppNotification[]
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
  dismiss: (id: string) => void
  clearAll: () => void
}

const Ctx = createContext<NotificationsValue | null>(null)

const alertKind = (a: ServiceAlert): NotificationKind => {
  if (a.kind === 'delay' || a.kind === 'route-blocked') return 'delay'
  if (a.kind === 'trip-start') return 'active'
  if (a.kind === 'trip-ended') return 'update'
  return 'alert'
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => createInitialNotifications(Date.now()))
  const { isFavorite } = useUserData()
  const toast = useToast()

  const push = useCallback(
    (n: Omit<AppNotification, 'id' | 'at' | 'read'>, tone: 'info' | 'warning' = 'info') => {
      setNotifications((list) => [{ ...n, id: crypto.randomUUID(), at: Date.now(), read: false }, ...list].slice(0, 40))
      toast({ title: n.title, description: n.body, tone })
    },
    [toast],
  )

  useFeedEvents(
    useCallback(
      (e) => {
        if (e.kind === 'alert') {
          const a = e.alert
          // Riders hear about what they follow: their buses, routes and stops. Network-wide announcements go to everyone.
          const global = !a.routeId && !a.busId && !a.stopId
          const follows = (a.busId && isFavorite('bus', a.busId)) || (a.routeId && isFavorite('route', a.routeId)) || (a.stopId && isFavorite('stop', a.stopId))
          if (!global && !follows) return
          push({ kind: alertKind(a), title: a.title, body: a.body, busId: a.busId, routeId: a.routeId }, a.kind === 'delay' || a.kind === 'route-blocked' || a.kind === 'service-unavailable' ? 'warning' : 'info')
          return
        }
        const nextStop = e.nextStopName ? stops.find((s) => s.name === e.nextStopName) : undefined
        const followsBus = isFavorite('bus', e.busId)
        const followsStop = !!nextStop && isFavorite('stop', nextStop.id)
        if (!followsBus && !followsStop) return
        const bus = getLiveFeed().getSnapshot().buses.find((b) => b.id === e.busId)
        if (!bus) return
        const insight = getBusInsight(bus)
        let routeName = ''
        try {
          routeName = routeById(bus.routeId).name
        } catch {
          /* the route was removed while the event was in flight */
        }
        const title = e.nextStopName ? `${e.busId} is approaching ${e.nextStopName}` : `${e.busId} reached its final stop`
        const body = e.nextStopName ? `Just left ${e.stopName} on ${routeName}. Arrives in about ${insight.etaNextMin ?? 1} min.` : `${e.stopName} is the last stop on ${routeName}.`
        push({ kind: 'approach', title, body, busId: e.busId, routeId: bus.routeId })
      },
      [isFavorite, push],
    ),
  )

  const markRead = useCallback((id: string) => setNotifications((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n))), [])
  const markAllRead = useCallback(() => setNotifications((l) => l.map((n) => ({ ...n, read: true }))), [])
  const dismiss = useCallback((id: string) => setNotifications((l) => l.filter((n) => n.id !== id)), [])
  const clearAll = useCallback(() => setNotifications([]), [])

  const value = useMemo<NotificationsValue>(
    () => ({ notifications, unreadCount: notifications.filter((n) => !n.read).length, markRead, markAllRead, dismiss, clearAll }),
    [notifications, markRead, markAllRead, dismiss, clearAll],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>')
  return ctx
}
