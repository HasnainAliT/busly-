import { Link, useNavigate } from 'react-router-dom'
import { Banknote, Clock, MapPinned, Radio, Repeat } from 'lucide-react'
import { MapView } from '@/components/map/MapView'
import { RouteTimeline } from '@/components/route/RouteTimeline'
import { FavoriteButton } from '@/components/bus/FavoriteButton'
import { BusCard } from '@/components/bus/BusCard'
import { Button } from '@/components/ui/button'
import { useLocationAccess } from '@/context/LocationContext'
import type { BusInsight } from '@/utils/bus'
import type { Route } from '@/types'

const noop = () => {}

export function RouteDetail({ route, insights, mapHeight = 'h-56' }: { route: Route; insights: BusInsight[]; mapHeight?: string }) {
  const loc = useLocationAccess()
  const navigate = useNavigate()
  const onRoute = insights.filter((i) => i.route.id === route.id)
  const nearest = onRoute.filter((b) => b.bus.status === 'active' || b.bus.status === 'delayed').sort((a, b) => a.etaDestMin - b.etaDestMin)[0]

  return (
    <div className="space-y-5">
      <div className={`relative overflow-hidden rounded-xl border border-white/10 ${mapHeight}`}>
        <MapView
          className="absolute inset-0"
          buses={onRoute}
          selectedBusId={null}
          onSelectBus={noop}
          userPosition={loc.position}
          fitRouteId={route.id}
          interactive={false}
          showControls={false}
          showLegend={false}
          showAllRouteLines={false}
          ariaLabel={`Map of route ${route.code}`}
        />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-bold">Route {route.code}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{route.name}</p>
        </div>
        <FavoriteButton kind="route" id={route.id} label={`Route ${route.code}`} />
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded-lg bg-white/4 p-3">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Repeat className="size-3" /> Every</dt>
          <dd className="mt-1 font-semibold">{route.frequencyMin} min</dd>
        </div>
        <div className="rounded-lg bg-white/4 p-3">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3" /> First</dt>
          <dd className="mt-1 font-semibold">{route.firstDeparture}</dd>
        </div>
        <div className="rounded-lg bg-white/4 p-3">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3" /> Last</dt>
          <dd className="mt-1 font-semibold">{route.lastDeparture}</dd>
        </div>
      <div className="rounded-lg bg-white/4 p-3">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Banknote className="size-3" /> Full fare</dt>
          <dd className="mt-1 font-semibold">PKR {route.fare}</dd>
        </div>
      </dl>

      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold"><MapPinned className="size-4 text-primary" /> Stops</h4>
        <RouteTimeline route={route} compact />
      </div>

      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Radio className="size-4 text-primary" /> Buses on this route</h4>
        <ul className="space-y-2.5">
          {onRoute.map((i) => (
            <li key={i.bus.id}>
              <BusCard insight={i} showFavorite={false} onSelect={(id) => navigate(`/app/map?bus=${id}`)} />
            </li>
          ))}
        </ul>
      </div>

      {nearest && (
        <Button asChild className="w-full">
          <Link to={`/app/map?bus=${nearest.bus.id}`}>Track {nearest.bus.id} live</Link>
        </Button>
      )}
    </div>
  )
}
