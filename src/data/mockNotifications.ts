import type { AppNotification } from '@/types'

const min = 60 * 1000

export function createInitialNotifications(now: number): AppNotification[] {
  return [
    { id: 'n1', kind: 'approach', title: 'BUS-104 is approaching your stop', body: 'MUET Main Gate in about 4 minutes. Head to the stop now.', at: now - 2 * min, read: false, busId: 'BUS-104', routeId: 'route-a' },
    { id: 'n2', kind: 'delay', title: 'Route A is running 5 minutes late', body: 'Heavy traffic near Kotri Bridge is slowing BUS-108.', at: now - 11 * min, read: false, busId: 'BUS-108', routeId: 'route-a' },
    { id: 'n3', kind: 'active', title: 'Your saved bus is now active', body: 'BUS-104 started its run and is reporting its location.', at: now - 38 * min, read: true, busId: 'BUS-104', routeId: 'route-a' },
    { id: 'n4', kind: 'update', title: 'Bus location was updated', body: 'BUS-310 reached Jamshoro Bypass on Route C.', at: now - 64 * min, read: true, busId: 'BUS-310', routeId: 'route-c' },
    { id: 'n5', kind: 'security', title: 'New sign-in on this browser', body: 'If this was not you, sign out and reset your password.', at: now - 26 * 60 * min, read: true },
  ]
}
