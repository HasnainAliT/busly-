import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getRouteGeometry } from '@/utils/geometry'
import type { BusInsight } from '@/utils/bus'
import type { Route } from '@/types'
import { routeStops } from '@/data/mockRoutes'

type Props =
  | { insight: BusInsight; route?: undefined; compact?: boolean }
  | { route: Route; insight?: undefined; compact?: boolean }

/** Vertical stop timeline. With a bus it shows live progress and per-stop ETAs; with a route only, scheduled offsets. */
export function RouteTimeline({ insight, route: routeProp, compact }: Props) {
  const route = insight?.route ?? routeProp!
  const stops = routeStops(route)
  const g = getRouteGeometry(route)
  const slowdown = insight && insight.bus.status === 'delayed' ? 1 + insight.bus.delayMin / Math.max(route.durationMin, 1) + 0.15 : 1

  return (
    <ol className="relative" aria-label={`Stops on route ${route.code}`}>
      {stops.map((stop, i) => {
        const passed = insight ? i < insight.currentStopIndex : false
        const current = insight ? i === insight.currentStopIndex : false
        const isLast = i === stops.length - 1
        const minutes = insight
          ? Math.max(0, Math.round((g.stopProgress[i] - insight.bus.progress) * route.durationMin * slowdown))
          : Math.round(g.stopProgress[i] * route.durationMin)

        return (
          <motion.li
            key={stop.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            className={cn('relative flex gap-3.5 pl-0', compact ? 'pb-4' : 'pb-6', isLast && 'pb-0')}
          >
            {!isLast && (
              <span
                aria-hidden
                className={cn('absolute left-[11px] top-6 w-0.5 rounded-full', compact ? 'h-[calc(100%-18px)]' : 'h-[calc(100%-22px)]', passed ? 'bg-primary/70' : 'bg-white/12')}
              />
            )}
            <span
              aria-hidden
              className={cn(
                'relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors',
                passed && 'border-primary bg-primary text-primary-foreground',
                current && 'border-primary bg-background',
                !passed && !current && 'border-white/20 bg-background',
                isLast && !passed && !current && 'border-secondary',
              )}
            >
              {passed && <Check className="size-3.5" strokeWidth={3} />}
              {current && <span className="size-2 rounded-full bg-primary" />}
              {current && <span className="absolute inset-0 animate-pulse-ring rounded-full border border-primary" />}
            </span>
            <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={cn('truncate text-sm font-semibold', passed && 'text-muted-foreground', current && 'text-foreground')}><Link to={`/app/stops/${stop.id}`} className="hover:underline focus-visible:underline">{stop.name}</Link>{stop.closed && <span className="ml-2 text-xs font-medium text-danger">Closed</span>}</p>
                <p className="text-xs text-muted-foreground">
                  {current ? 'Bus is here or just passed' : i === 0 && !insight ? 'Origin' : isLast ? 'Final stop' : passed ? 'Passed' : insight && i === insight.currentStopIndex + 1 ? 'Next stop' : ' '}
                </p>
              </div>
              <span className={cn('shrink-0 text-sm font-semibold tabular-nums', passed ? 'text-muted-foreground/70' : 'text-foreground')}>
                {insight ? (passed ? 'Done' : current ? 'Now' : `${minutes} min`) : i === 0 ? 'Start' : `+${minutes} min`}
              </span>
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}
