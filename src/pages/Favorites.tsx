import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bus, Heart, MapPin, Route as RouteIcon } from 'lucide-react'
import { BusCard } from '@/components/bus/BusCard'
import { FavoriteButton } from '@/components/bus/FavoriteButton'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FeedError, OfflineBanner, StateCard } from '@/components/ui/states'
import { useBuses } from '@/hooks/useLiveFeed'
import { useUserData, type FavoriteKind } from '@/context/UserDataContext'
import { routes, stops, routeById } from '@/data/mockRoutes'
import { getRouteGeometry } from '@/utils/geometry'
import { cn } from '@/lib/utils'

const tabs: { id: FavoriteKind; label: string; icon: typeof Bus }[] = [
  { id: 'bus', label: 'Buses', icon: Bus },
  { id: 'route', label: 'Routes', icon: RouteIcon },
  { id: 'stop', label: 'Stops', icon: MapPin },
]

export default function FavoritesPage() {
  const { insights, status, feed } = useBuses()
  const { favorites } = useUserData()
  const navigate = useNavigate()
  const [tab, setTab] = useState<FavoriteKind>('bus')

  const savedBuses = insights.filter((i) => favorites.bus.includes(i.bus.id))
  const savedRoutes = routes.filter((r) => favorites.route.includes(r.id))
  const savedStops = stops.filter((s) => favorites.stop.includes(s.id))

  /** Soonest bus still to reach a stop, across all routes that serve it. */
  const nextAtStop = useMemo(() => {
    const out = new Map<string, { busId: string; min: number } | null>()
    for (const s of stops) {
      let best: { busId: string; min: number } | null = null
      for (const i of insights) {
        if (i.bus.status === 'offline') continue
        const idx = i.route.stopIds.indexOf(s.id)
        if (idx < 0) continue
        const g = getRouteGeometry(i.route)
        const left = g.stopProgress[idx] - i.bus.progress
        if (left < 0) continue
        const min = Math.max(1, Math.round(left * i.route.durationMin))
        if (!best || min < best.min) best = { busId: i.bus.id, min }
      }
      out.set(s.id, best)
    }
    return out
  }, [insights])

  const counts: Record<FavoriteKind, number> = { bus: savedBuses.length, route: savedRoutes.length, stop: savedStops.length }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Favorites</h1>
        <p className="mt-1.5 text-muted-foreground">Buses, routes and stops you follow. Saved buses send you arrival alerts.</p>
      </div>

      <div role="tablist" aria-label="Favorite type" className="glass mb-6 grid grid-cols-3 gap-1 rounded-xl p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn('flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors', tab === id ? 'bg-white/12 text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            <Icon className="size-4" />
            {label}
            <span className="rounded-md bg-white/10 px-1.5 text-xs tabular-nums">{counts[id]}</span>
          </button>
        ))}
      </div>

      {status === 'offline' && <OfflineBanner className="mb-4" />}

      {status === 'error' ? (
        <FeedError onRetry={() => feed.retry()} className="glass rounded-2xl" />
      ) : status === 'connecting' ? (
        <div className="space-y-3" role="status" aria-label="Loading favorites">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div role="tabpanel">
          {tab === 'bus' &&
            (savedBuses.length === 0 ? (
              <StateCard className="glass rounded-2xl" icon={<Heart />} title="No saved buses yet" description="Tap the heart on any bus to follow it and get alerts when it's approaching." action={<Button asChild><Link to="/app/buses">Browse buses</Link></Button>} />
            ) : (
              <ul className="space-y-3">
                {savedBuses.map((i, n) => (
                  <li key={i.bus.id}>
                    <BusCard insight={i} index={n} onSelect={(id) => navigate(`/app/buses/${id}`)} />
                  </li>
                ))}
              </ul>
            ))}

          {tab === 'route' &&
            (savedRoutes.length === 0 ? (
              <StateCard className="glass rounded-2xl" icon={<RouteIcon />} title="No saved routes yet" description="Save the routes you take every day to check them in one tap." action={<Button asChild><Link to="/app/routes">Find routes</Link></Button>} />
            ) : (
              <ul className="space-y-3">
                {savedRoutes.map((r) => {
                  const live = insights.filter((i) => i.route.id === r.id && i.bus.status !== 'offline').length
                  return (
                    <li key={r.id} className="glass flex items-center gap-4 rounded-xl p-4">
                      <span className="grid size-11 shrink-0 place-items-center rounded-lg font-display text-lg font-bold" style={{ background: `hsl(${r.hue} 90% 62% / .16)`, color: `hsl(${r.hue} 90% 68%)` }}>{r.code}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{routeById(r.id).name}</p>
                        <p className="text-sm text-muted-foreground">{r.durationMin} min · {live} {live === 1 ? 'bus' : 'buses'} running</p>
                      </div>
                      <Button asChild variant="subtle" size="sm"><Link to={`/app/routes?route=${r.id}`}>View</Link></Button>
                      <FavoriteButton kind="route" id={r.id} label={`Route ${r.code}`} quiet />
                    </li>
                  )
                })}
              </ul>
            ))}

          {tab === 'stop' && (
            <div className="space-y-6">
              {savedStops.length === 0 ? (
                <StateCard className="glass rounded-2xl" icon={<MapPin />} title="No saved stops yet" description="Save the stops you wait at. Pick some below to see the next bus for each." />
              ) : (
                <ul className="space-y-3">
                  {savedStops.map((s) => {
                    const next = nextAtStop.get(s.id)
                    return (
                      <li key={s.id} className="glass flex items-center gap-4 rounded-xl p-4">
                        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary"><MapPin className="size-5" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{s.name}</p>
                          <p className="text-sm text-muted-foreground">{next ? `Next bus: ${next.busId} in ${next.min} min` : 'No bus approaching right now'}</p>
                        </div>
                        <FavoriteButton kind="stop" id={s.id} label={s.name} quiet />
                      </li>
                    )
                  })}
                </ul>
              )}
              <div>
                <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Add stops</h2>
                <div className="flex flex-wrap gap-2">
                  {stops.filter((s) => !favorites.stop.includes(s.id)).map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/4 py-0.5 pl-3 pr-0.5 text-[13px] font-medium">
                      {s.name}
                      <FavoriteButton kind="stop" id={s.id} label={s.name} quiet className="size-8" />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
