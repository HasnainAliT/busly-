import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin } from 'lucide-react'
import { Panel } from '@/components/ui/form'
import { Badge } from '@/components/ui/badge'
import { StateCard } from '@/components/ui/states'
import { ServiceAlerts } from '@/components/alerts/ServiceAlerts'
import { StatusBadge } from '@/components/bus/StatusBadge'
import { useBuses, useTransit } from '@/hooks/useLiveFeed'
import { etaToStop } from '@/domain/engine'
import { formatEta } from '@/utils/bus'

/** Everything a rider needs at one stop: routes serving it and the buses that have not passed yet, soonest first. */
export default function StopPage() {
  const { id } = useParams()
  const data = useTransit()
  const { insights } = useBuses()
  const stop = data.stops.find((s) => s.id === id)
  const routes = data.routes.filter((r) => stop && r.stopIds.includes(stop.id))

  const arrivals = useMemo(() => {
    if (!stop) return []
    return insights
      .filter((i) => routes.some((r) => r.id === i.bus.routeId) && (i.bus.status === 'active' || i.bus.status === 'delayed') && !i.bus.locationLost)
      .map((i) => ({ i, eta: etaToStop(data, i.bus, stop.id) }))
      .filter((x): x is { i: (typeof insights)[number]; eta: number } => x.eta != null)
      .sort((a, b) => a.eta - b.eta)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insights, stop, data.version])

  if (!stop) return <div className="mx-auto max-w-xl px-4 py-10"><StateCard icon={<MapPin />} title="Stop not found" description="This stop doesn't exist or was removed." action={<Link className="underline" to="/app/routes">Back to routes</Link>} /></div>

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 md:py-8">
      <Link to="/app/routes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Routes</Link>
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{stop.name}</h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {routes.map((r) => <Badge key={r.id} tone="neutral">Route {r.code}</Badge>)}
          {stop.closed && <Badge tone="danger">Closed{stop.closedReason ? `: ${stop.closedReason}` : ''}</Badge>}
        </p>
      </div>
      <ServiceAlerts />
      <Panel title="Buses approaching">
        {stop.closed ? (
          <p className="text-sm text-muted-foreground">Buses do not stop here while it is closed.</p>
        ) : arrivals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bus is on its way right now. Routes here run every {Math.min(...routes.map((r) => r.frequencyMin), 99)} minutes or so in service hours.</p>
        ) : (
          <ul className="divide-y divide-white/8" aria-label="Approaching buses">
            {arrivals.map(({ i, eta }) => (
              <li key={i.bus.id} className="flex items-center justify-between gap-3 py-3">
                <Link to={`/app/buses/${i.bus.id}`} className="min-w-0">
                  <p className="font-semibold">Bus {i.bus.busNumber} <span className="font-normal text-muted-foreground">to {i.route.to}</span></p>
                  <p className="mt-1"><StatusBadge status={i.bus.status} delayMin={i.bus.delayMin} /></p>
                </Link>
                <p className="font-display text-2xl font-bold tabular-nums">{formatEta(eta)}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
