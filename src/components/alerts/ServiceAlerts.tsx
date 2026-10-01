import { Megaphone, TriangleAlert } from 'lucide-react'
import { useTransit } from '@/hooks/useLiveFeed'
import { formatAgo } from '@/utils/bus'
import { cn } from '@/lib/utils'

/** Active operator announcements and closed stops, shown to riders. Optionally limited to one route. */
export function ServiceAlerts({ routeId, className, limit = 3 }: { routeId?: string; className?: string; limit?: number }) {
  const { alerts, stops, routes } = useTransit()
  const active = alerts.filter((a) => a.active && (!routeId || !a.routeId || a.routeId === routeId))
  const closed = stops.filter((s) => s.closed && !active.some((a) => a.stopId === s.id) && (!routeId || routes.find((r) => r.id === routeId)?.stopIds.includes(s.id)))
  if (!active.length && !closed.length) return null
  return (
    <section aria-label="Service alerts" className={cn('space-y-2', className)}>
      {active.slice(0, limit).map((a) => (
        <div key={a.id} role="status" className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3.5 text-sm">
          <Megaphone className="mt-0.5 size-[18px] shrink-0 text-warning" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold">{a.title}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{a.body} <span className="whitespace-nowrap">· {formatAgo(a.createdAt)}</span></p>
          </div>
        </div>
      ))}
      {closed.map((s) => (
        <div key={s.id} className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-3.5 text-sm">
          <TriangleAlert className="mt-0.5 size-[18px] shrink-0 text-danger" aria-hidden />
          <p><b>{s.name}</b> is closed{s.closedReason ? `: ${s.closedReason}` : ''}. Buses will not stop here.</p>
        </div>
      ))}
    </section>
  )
}
