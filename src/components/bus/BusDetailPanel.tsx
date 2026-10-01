import { Link } from 'react-router-dom'
import { Accessibility, ArrowRight, CircleCheck, Clock, Gauge, MapPin, MapPinOff, QrCode, Radio, Route as RouteIcon, UserRound, WifiOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/bus/StatusBadge'
import { useAuth } from '@/context/AuthContext'
import { useDispatch } from '@/hooks/useDispatch'
import { OccupancyMeter } from '@/components/bus/OccupancyMeter'
import { FavoriteButton } from '@/components/bus/FavoriteButton'
import { LiveDot } from '@/components/ui/live-dot'
import { useNow } from '@/hooks/useLiveFeed'
import { formatAgo, formatEta, formatKm, statusMeta, type BusInsight } from '@/utils/bus'
import { cn } from '@/lib/utils'

interface Props {
  insight: BusInsight
  onClose?: () => void
  onShowQr?: () => void
  linkBase?: string
  className?: string
  hideActions?: boolean
  hideHeader?: boolean
  hideHero?: boolean
}

const driverLabel = { 'on-duty': 'On duty', break: 'On break', 'off-duty': 'Off duty' } as const

export function BusDetailPanel({ insight, onClose, onShowQr, linkBase = '/app/buses', className, hideActions, hideHeader, hideHero }: Props) {
  const { bus, route, nextStop, currentStop } = insight
  const { user } = useAuth()
  const now = useNow(1000)
  const offline = bus.status === 'offline'
  const notRunning = bus.status === 'available'
  const lost = insight.unavailable && !offline
  const quiet = offline || notRunning || lost
  const upcoming = insight.stops.slice(insight.currentStopIndex + 1, insight.currentStopIndex + 4)

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {!hideHeader && (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold leading-none">{bus.id}</h2>
            <StatusBadge status={bus.status} delayMin={bus.delayMin} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Route {route.code}: {route.from} to {route.to}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <FavoriteButton kind="bus" id={bus.id} label={bus.id} />
          {onClose && (
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close bus details" className="border border-white/10">
              <X />
            </Button>
          )}
        </div>
      </div>
      )}

      {hideHero ? null : lost ? (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3.5 text-sm">
          <MapPinOff className="mt-0.5 size-[18px] shrink-0 text-warning" />
          <div>
            <p className="font-semibold">Location temporarily unavailable</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              The driver's GPS stopped reporting {formatAgo(bus.lastGpsAt ?? bus.lastUpdated, now)}. We don't show an arrival time until it comes back, so you never see out-of-date numbers.
            </p>
          </div>
        </div>
      ) : notRunning ? (
        <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/8 p-3.5 text-sm">
          <CircleCheck className="mt-0.5 size-[18px] shrink-0 text-primary" />
          <div>
            <p className="font-semibold">Waiting for its next trip</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">This bus is available at {currentStop.name}. It will appear on the map as soon as the driver starts a trip.</p>
          </div>
        </div>
      ) : offline ? (
        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 text-sm">
          <WifiOff className="mt-0.5 size-[18px] shrink-0 text-muted-foreground" />
          <div>
            <p className="font-semibold">This bus is not in service right now</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Last known position near {currentStop.name}. Last signal {formatAgo(bus.lastUpdated, now)}.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-accent to-card p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Arrives at {route.to} in</p>
              <p className="mt-1 font-display text-4xl font-bold leading-none tabular-nums">
                {String(insight.etaDestMin).padStart(2, '0')}
                <span className="ml-1.5 text-base font-medium text-muted-foreground">min</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatKm(insight.distDestKm)} to go at {bus.speedKmh} km/h
              </p>
            </div>
            <div className="text-right text-[13px]">
              <p className="text-muted-foreground">Next stop</p>
              <p className="max-w-[10rem] truncate font-semibold">{nextStop ? nextStop.name : 'Final stop'}</p>
              {insight.etaNextMin != null && (
                <p className="text-primary">
                  in {formatEta(insight.etaNextMin)}
                  {insight.distNextKm != null ? ` · ${formatKm(insight.distNextKm)}` : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-2.5 text-sm">
        <Fact icon={<MapPin />} label="Current stop" value={currentStop.name} />
        <Fact icon={<Gauge />} label="Speed" value={quiet ? 'Not moving' : `${bus.speedKmh} km/h`} />
        <Fact icon={<UserRound />} label="Driver" value={driverLabel[bus.driverStatus]} />
        <Fact icon={<Accessibility />} label="Vehicle" value={bus.accessible ? 'Step-free access' : 'Standard access'} />
        {bus.locSource && <Fact icon={<RouteIcon />} label="Location source" value={bus.locSource === 'gps' ? 'Driver phone GPS' : 'Simulated GPS'} />}
        {bus.delayMin > 0 && <Fact icon={<Clock />} label="Delay" value={`About ${bus.delayMin} min`} />}
      </dl>

      {!quiet && <OccupancyMeter value={bus.occupancy} label={insight.occupancyLabel} />}
      {!quiet && user && <CrowdReport busId={bus.id} />}

      {upcoming.length > 0 && !quiet && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Upcoming stops</p>
          <ul className="space-y-1.5">
            {upcoming.map((s, i) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/4 px-3 py-2 text-sm">
                <span className="truncate">{s.name}</span>
                {i === 0 && insight.etaNextMin != null && <span className="shrink-0 text-xs font-semibold text-primary">{insight.etaNextMin} min</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-white/8 pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {offline || lost ? <WifiOff className="size-3.5" /> : <LiveDot tone={insight.isStale ? 'warning' : 'success'} />}
          <Clock className="size-3.5" />
          Last updated {formatAgo(bus.lastUpdated, now)}
        </span>
        <span className="flex items-center gap-1.5">
          <Radio className="size-3.5" />
          {statusMeta[bus.status].description}
        </span>
      </div>

      {!hideActions && (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button asChild>
            <Link to={`${linkBase}/${bus.id}`}>
              View full details <ArrowRight />
            </Link>
          </Button>
          {onShowQr && (
            <Button variant="glass" size="icon" onClick={onShowQr} aria-label={`Show QR code for ${bus.id}`}>
              <QrCode />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function CrowdReport({ busId }: { busId: string }) {
  const { run, pending } = useDispatch()
  const levels = [
    { v: 'seats', l: 'Seats free' },
    { v: 'filling', l: 'Filling up' },
    { v: 'full', l: 'Standing only' },
  ] as const
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">On this bus? Tell others how full it is</p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Report crowding">
        {levels.map((x) => (
          <Button key={x.v} size="sm" variant="glass" disabled={pending} onClick={() => void run({ type: 'crowd/report', busId, level: x.v }, { success: 'Thanks, crowding updated' })}>
            {x.l}
          </Button>
        ))}
      </div>
    </div>
  )
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-white/4 p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 truncate font-semibold">{value}</dd>
    </div>
  )
}
