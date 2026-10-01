import { memo } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Bus, Clock, MapPin, Banknote, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FavoriteButton } from '@/components/bus/FavoriteButton'
import { cn } from '@/lib/utils'
import type { RouteMatch } from '@/utils/routeSearch'

interface Props {
  match: RouteMatch
  selected?: boolean
  onView: (routeId: string) => void
  index?: number
  searched: boolean
}

function RouteCardBase({ match, selected, onView, index = 0, searched }: Props) {
  const { route } = match
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 6) * 0.05 }}
      className={cn('glass group relative overflow-hidden rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 sm:p-5', selected && 'border-primary/50 shadow-[0_0_0_1px_hsl(var(--primary)/.45)]')}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: `hsl(${route.hue} 58% 44%)` }} aria-hidden />
      <div className="flex items-start justify-between gap-3 pl-1.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="font-display text-lg font-semibold">Route {route.code}</h3>
            {match.etaMin != null ? (
              <span className="rounded-md bg-success/12 px-2 py-0.5 text-xs font-semibold text-success">Next bus in {match.etaMin} min</span>
            ) : (
              <span className="rounded-md bg-white/6 px-2 py-0.5 text-xs font-medium text-muted-foreground">No bus approaching</span>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">{route.name}</p>
          {searched && (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <MapPin className="size-3.5 shrink-0 text-primary" />
              <span className="truncate">Board at {match.fromStop.name}, get off at {match.toStop.name}</span>
            </p>
          )}
        </div>
        <FavoriteButton kind="route" id={route.id} label={`Route ${route.code}`} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 pl-1.5 text-sm sm:grid-cols-4">
        <div className="rounded-lg bg-white/4 px-3 py-2.5">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Banknote className="size-3" /> Fare</dt>
          <dd className="mt-0.5 font-display text-base font-bold tabular-nums">PKR {match.fare}</dd>
        </div>
        <div className="rounded-lg bg-white/4 px-3 py-2.5">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3" /> Trip time</dt>
          <dd className="mt-0.5 font-display text-base font-bold tabular-nums">{match.durationMin} min</dd>
        </div>
        <div className="rounded-lg bg-white/4 px-3 py-2.5">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3" /> Stops</dt>
          <dd className="mt-0.5 font-display text-base font-bold tabular-nums">{match.stopCount}</dd>
        </div>
        <div className="rounded-lg bg-white/4 px-3 py-2.5">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Bus className="size-3" /> Buses</dt>
          <dd className="mt-0.5 font-display text-base font-bold tabular-nums">{match.busesNearby}</dd>
        </div>
      </dl>
      {match.closedStops.length > 0 && (
        <p className="mt-3 flex items-start gap-2 pl-1.5 text-[13px] text-warning"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> Closed on this trip: {match.closedStops.join(', ')}</p>
      )}

      <div className="mt-4 pl-1.5">
        <Button variant={selected ? 'default' : 'subtle'} className="w-full sm:w-auto" onClick={() => onView(route.id)}>
          View route <ArrowRight />
        </Button>
      </div>
    </motion.article>
  )
}

export const RouteCard = memo(RouteCardBase)
