import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { Panel } from '@/components/ui/form'
import { getLiveFeed } from '@/services/liveFeed'
import { actualMinutes } from '@/domain/analytics'
import { formatClock } from '@/utils/bus'
import type { Trip } from '@/types'

const statusText: Record<Trip['status'], string> = {
  'on-route': 'Running',
  delayed: 'Running late',
  'temporary-stop': 'Stopped',
  completed: 'Completed',
  cancelled: 'Cancelled',
  'ended-vehicle-issue': 'Ended: vehicle issue',
}

/** The signed-in driver's own recent trips. */
export function TripHistory({ refreshKey, routeCode }: { refreshKey: string | null; routeCode: (id: string) => string }) {
  const [trips, setTrips] = useState<Trip[] | null>(null)

  useEffect(() => {
    let alive = true
    getLiveFeed()
      .getTrips(8)
      .then((t) => alive && setTrips(t.filter((x) => x.endTime != null)))
      .catch(() => alive && setTrips([]))
    return () => {
      alive = false
    }
  }, [refreshKey])

  return (
    <Panel title="Recent trips">
      {trips == null ? (
        <p className="text-sm text-muted-foreground">Loading your trips…</p>
      ) : trips.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <History className="size-4" /> Finished trips show up here.
        </p>
      ) : (
        <ul className="space-y-2">
          {trips.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-white/4 px-3 py-2.5 text-sm">
              <span className="font-semibold">
                {t.busId} · Route {routeCode(t.routeId)}
              </span>
              <span className="text-muted-foreground">
                {statusText[t.status]} · {Math.round(actualMinutes(t))} min{t.delayMinutes ? ` · ${t.delayMinutes} min late` : ''} · {formatClock(t.startTime)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
