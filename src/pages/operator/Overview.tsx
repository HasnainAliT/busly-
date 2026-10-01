import { Link } from 'react-router-dom'
import { Bell, TriangleAlert } from 'lucide-react'
import { Panel, Tile } from '@/components/ui/form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/bus/StatusBadge'
import { MapView } from '@/components/map/MapView'
import { useAnalytics, useBuses, useTransit } from '@/hooks/useLiveFeed'
import { formatAgo } from '@/utils/bus'
import { useState } from 'react'

export default function Overview() {
  const { routes, alerts, reports, drivers } = useTransit()
  const { insights } = useBuses()
  const { analytics: a } = useAnalytics()
  const [sel, setSel] = useState<string | null>(null)
  const openAlerts = alerts.filter((x) => x.active)
  const openReports = reports.filter((r) => r.status === 'open')
  const watch = insights.filter((i) => i.bus.status === 'delayed' || i.bus.locationLost || i.bus.status === 'offline').slice(0, 6)

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Operations overview</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Buses running" value={(a?.fleet.active ?? 0) + (a?.fleet.delayed ?? 0)} sub={`${a?.fleet.total ?? 0} in fleet`} />
        <Tile label="Delayed" value={a?.fleet.delayed ?? 0} tone={a?.fleet.delayed ? 'warning' : undefined} sub={`${a?.fleet.offline ?? 0} offline`} />
        <Tile label="Routes running" value={a?.routesRunning ?? 0} sub={`${routes.filter((r) => r.active).length} active routes`} />
        <Tile label="Trips today" value={a?.tripsCompletedToday ?? 0} sub={`${a?.tripsActive ?? 0} in progress`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Live fleet" className="overflow-hidden">
          <div className="relative -mx-4 -mb-4 h-[340px] overflow-hidden sm:-mx-5 sm:-mb-5 sm:h-[420px]">
            <MapView className="absolute inset-0" buses={insights} selectedBusId={sel} onSelectBus={setSel} userPosition={null} showAllRouteLines ariaLabel="Live fleet map" />
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Needs attention" action={<Badge tone={watch.length ? 'warning' : 'success'}>{watch.length ? `${watch.length} buses` : 'All clear'}</Badge>}>
            {watch.length === 0 ? (
              <p className="text-sm text-muted-foreground">No delayed or offline buses right now.</p>
            ) : (
              <ul className="space-y-2.5">
                {watch.map((i) => (
                  <li key={i.bus.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-semibold">Bus {i.bus.busNumber}</span>
                    <span className="flex items-center gap-2">
                      {i.bus.locationLost && <Badge tone="warning">Location lost</Badge>}
                      <StatusBadge status={i.bus.status} delayMin={i.bus.delayMin} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Open alerts and reports" action={<Button asChild size="sm" variant="glass"><Link to="/operator/alerts"><Bell /> Manage</Link></Button>}>
            <ul className="space-y-2.5 text-sm">
              {openAlerts.slice(0, 3).map((x) => (
                <li key={x.id} className="flex gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" /><span><b>{x.title}</b> <span className="text-muted-foreground">{formatAgo(x.createdAt)}</span></span></li>
              ))}
              {openReports.slice(0, 3).map((r) => (
                <li key={r.id} className="text-muted-foreground">Rider report: {r.category} (bus {r.busId})</li>
              ))}
              {openAlerts.length + openReports.length === 0 && <li className="text-muted-foreground">Nothing open.</li>}
            </ul>
          </Panel>

          <Panel title="On duty">
            <p className="text-sm text-muted-foreground">{drivers.filter((d) => d.status === 'on-duty').length} of {drivers.length} drivers on duty</p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
