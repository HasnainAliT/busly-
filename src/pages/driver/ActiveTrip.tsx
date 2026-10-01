import { useEffect, useMemo, useRef, useState } from 'react'
import { Ban, Clock, Flag, Gauge, MapPinOff, Navigation, Pause, Play, Satellite, Smartphone, Square, TriangleAlert, Wrench } from 'lucide-react'
import { MapView } from '@/components/map/MapView'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Panel, TextareaField } from '@/components/ui/form'
import { StatusBadge } from '@/components/bus/StatusBadge'
import { useDispatch } from '@/hooks/useDispatch'
import { useGps } from '@/hooks/useGps'
import { useNow } from '@/hooks/useLiveFeed'
import { formatClock, formatEta, formatKm, type BusInsight } from '@/utils/bus'
import { cn } from '@/lib/utils'
import type { Trip, TripEvent } from '@/types'

type Dialog = null | 'delay' | 'blocked' | 'issue' | 'end'

const DELAY_CHOICES = [5, 10, 15, 20, 30]
const SEND_EVERY_MS = 3000

const eventText: Record<TripEvent['type'], string> = {
  started: 'Trip started',
  'traffic-delay': 'Traffic delay reported',
  'vehicle-issue': 'Vehicle issue reported',
  'route-blocked': 'Route blocked reported',
  'temporary-stop': 'Temporary stop',
  resumed: 'Resumed',
  completed: 'Trip completed',
  cancelled: 'Trip cancelled',
  'stop-reached': 'Reached a stop',
  'location-lost': 'Location lost',
  'location-restored': 'Location restored',
}

export function ActiveTrip({ trip, insight, stopName }: { trip: Trip; insight: BusInsight; stopName: (id: string) => string }) {
  const { bus, route } = insight
  const now = useNow(1000)
  const { run, pending } = useDispatch()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [delayMin, setDelayMin] = useState(10)
  const [note, setNote] = useState('')
  const [gpsError, setGpsError] = useState<string | null>(null)
  const usingGps = trip.locSource === 'gps'
  const paused = bus.status === 'break'

  /* Phone GPS: forward each fix to the backend, at most every few seconds. */
  const gps = useGps(usingGps)
  const lastSent = useRef(0)
  useEffect(() => {
    if (!usingGps || !gps.fix || gps.fix.at === lastSent.current) return
    if (gps.fix.at - lastSent.current < SEND_EVERY_MS) return
    lastSent.current = gps.fix.at
    void run({ type: 'driver/location', busId: bus.id, lat: gps.fix.lat, lng: gps.fix.lng, speedKmh: gps.fix.speedKmh, accuracy: gps.fix.accuracyM }, { quiet: true }).then((r) => setGpsError(r.ok ? null : r.message))
  }, [gps.fix, usingGps, bus.id, run])

  const close = () => {
    setDialog(null)
    setNote('')
  }

  const update = async (kind: 'traffic-delay' | 'route-blocked' | 'temporary-stop' | 'resume' | 'vehicle-issue', success: string, extra: { delayMin?: number; note?: string } = {}) => {
    const r = await run({ type: 'trip/update', tripId: trip.id, kind, ...extra }, { success })
    if (r.ok) close()
  }

  const end = async () => {
    const r = await run({ type: 'trip/end', tripId: trip.id }, { success: 'Trip ended' })
    if (r.ok) close()
  }

  const events = useMemo(() => [...trip.events].filter((e) => e.type !== 'stop-reached').slice(-5).reverse(), [trip.events])
  const progressPct = Math.round(bus.progress * 100)
  const lastFixAge = gps.fix ? Math.round((now - gps.fix.at) / 1000) : null

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-bold leading-none">{bus.id}</h2>
              <StatusBadge status={bus.status} delayMin={bus.delayMin} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Route {route.code}: {route.from} to {route.to}
            </p>
          </div>
          <span className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold', usingGps ? 'border-success/30 bg-success/10 text-success' : 'border-primary/30 bg-primary/10 text-primary')}>
            {usingGps ? <Smartphone className="size-3.5" /> : <Satellite className="size-3.5" />}
            {usingGps ? 'Phone GPS' : 'Simulated GPS'}
          </span>
        </div>

        {!usingGps && (
          <p className="mt-3 rounded-lg bg-primary/8 px-3 py-2 text-[13px] text-muted-foreground">This route is being simulated. Riders see the same "Simulated GPS" label on their screens.</p>
        )}

        <div className="mt-4" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Route progress">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">{insight.currentStop.name}</span>
            <span className="tabular-nums">{progressPct}%</span>
            <span className="truncate">{route.to}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/8">
            <div className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2.5 text-sm sm:grid-cols-4">
          <Stat icon={<Navigation />} label="Next stop" value={insight.nextStop ? insight.nextStop.name : 'Final stop'} sub={insight.etaNextMin != null ? formatEta(insight.etaNextMin) : undefined} />
          <Stat icon={<Flag />} label={`Arrive ${route.to}`} value={formatEta(insight.etaDestMin)} sub={formatKm(insight.distDestKm)} />
          <Stat icon={<Gauge />} label="Speed" value={paused ? 'Stopped' : `${bus.speedKmh} km/h`} />
          <Stat icon={<Clock />} label="Delay" value={bus.delayMin ? `${bus.delayMin} min` : 'On time'} />
        </dl>
      </Panel>

      {usingGps && (
        <Panel title="Phone GPS">
          <GpsStatus state={gps.state} accuracy={gps.fix?.accuracyM ?? null} ageSec={lastFixAge} lost={bus.locationLost} serverError={gpsError} />
        </Panel>
      )}

      <div className="h-56 overflow-hidden rounded-2xl border border-white/10 sm:h-72">
        <MapView buses={[insight]} selectedBusId={bus.id} onSelectBus={() => {}} userPosition={null} fitRouteId={route.id} interactive={false} showControls={false} showLegend={false} focusZoom={2.2} followSelected ariaLabel={`Route ${route.code} map showing ${bus.id}`} />
      </div>

      <Panel title="Trip actions">
        <div className="grid grid-cols-2 gap-3">
          <ActionButton icon={<TriangleAlert />} label="Traffic delay" onClick={() => setDialog('delay')} disabled={pending} />
          <ActionButton icon={<Ban />} label="Route blocked" onClick={() => setDialog('blocked')} disabled={pending} />
          {paused ? (
            <ActionButton icon={<Play />} label="Resume trip" onClick={() => void update('resume', 'Trip resumed')} disabled={pending} tone="primary" />
          ) : (
            <ActionButton icon={<Pause />} label="Temporary stop" onClick={() => void update('temporary-stop', 'Stopped temporarily')} disabled={pending} />
          )}
          <ActionButton icon={<Wrench />} label="Vehicle issue" onClick={() => setDialog('issue')} disabled={pending} tone="danger" />
        </div>
        <Button variant="destructive" size="lg" className="mt-3 w-full" onClick={() => setDialog('end')} disabled={pending}>
          <Square /> End trip
        </Button>
      </Panel>

      <Panel title="This trip">
        <ol className="space-y-2 text-sm">
          {events.map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex items-baseline justify-between gap-3 rounded-lg bg-white/4 px-3 py-2">
              <span>
                {eventText[e.type]}
                {e.note && e.type !== 'stop-reached' ? <span className="text-muted-foreground"> · {e.note}</span> : null}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatClock(e.at)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">Last stop served: {stopName(trip.currentStopId)}</p>
      </Panel>

      <Modal open={dialog === 'delay'} onOpenChange={(o) => !o && close()} title="Report a traffic delay" description="Riders on this route get an alert with the new delay.">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void update('traffic-delay', 'Delay reported', { delayMin, note })
          }}
          className="space-y-4"
        >
          <fieldset>
            <legend className="mb-2 text-sm font-medium">How late are you running?</legend>
            <div className="flex flex-wrap gap-2">
              {DELAY_CHOICES.map((m) => (
                <label key={m} className={cn('cursor-pointer rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-ring/60', delayMin === m ? 'border-primary/60 bg-primary/15 text-primary' : 'border-white/10 bg-white/5')}>
                  <input type="radio" name="delay" className="sr-only" checked={delayMin === m} onChange={() => setDelayMin(m)} />
                  {m} min
                </label>
              ))}
            </div>
          </fieldset>
          <TextareaField label="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value.slice(0, 140))} placeholder="Road works near Kotri Bridge" maxLength={140} />
          <Button type="submit" className="w-full" disabled={pending}>
            Send delay report
          </Button>
        </form>
      </Modal>

      <Modal open={dialog === 'blocked'} onOpenChange={(o) => !o && close()} title="Report a blocked route" description="Adds about 10 minutes of delay and alerts riders on this route.">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void update('route-blocked', 'Blocked route reported', { note })
          }}
          className="space-y-4"
        >
          <TextareaField label="What is blocking the road? (optional)" value={note} onChange={(e) => setNote(e.target.value.slice(0, 140))} maxLength={140} />
          <Button type="submit" className="w-full" disabled={pending}>
            Send report
          </Button>
        </form>
      </Modal>

      <Modal open={dialog === 'issue'} onOpenChange={(o) => !o && close()} title="Report a vehicle issue" description="This ends your trip and takes the bus out of service until an operator brings it back.">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void update('vehicle-issue', 'Trip ended: vehicle issue', { note })
          }}
          className="space-y-4"
        >
          <TextareaField label="What is wrong? (optional)" value={note} onChange={(e) => setNote(e.target.value.slice(0, 140))} maxLength={140} placeholder="Flat tyre" />
          <Button type="submit" variant="destructive" className="w-full" disabled={pending}>
            End trip and report issue
          </Button>
        </form>
      </Modal>

      <Modal open={dialog === 'end'} onOpenChange={(o) => !o && close()} title="End this trip?" description="The bus becomes available again and riders are told the trip is over.">
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={close}>
            Keep driving
          </Button>
          <Button variant="destructive" onClick={() => void end()} disabled={pending}>
            End trip
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-white/4 p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
        {icon}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-1 truncate font-semibold">{value}</dd>
      {sub && <dd className="text-xs text-primary">{sub}</dd>}
    </div>
  )
}

function ActionButton({ icon, label, onClick, disabled, tone }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; tone?: 'primary' | 'danger' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 [&_svg]:size-5',
        tone === 'danger' ? 'border-danger/30 bg-danger/10 text-danger hover:bg-danger/15' : tone === 'primary' ? 'border-primary/40 bg-primary/15 text-primary hover:bg-primary/20' : 'border-white/10 bg-white/5 hover:bg-white/10',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function GpsStatus({ state, accuracy, ageSec, lost, serverError }: { state: ReturnType<typeof useGps>['state']; accuracy: number | null; ageSec: number | null; lost: boolean; serverError: string | null }) {
  if (state === 'denied')
    return <Note tone="danger" title="Location permission is blocked">Allow location for this site in your browser settings, then reload. Riders currently see "Location temporarily unavailable".</Note>
  if (state === 'unavailable')
    return <Note tone="danger" title="This device can't provide a location">Turn on GPS or switch to a phone with location services. Riders currently see "Location temporarily unavailable".</Note>
  if (state === 'error') return <Note tone="warning" title="GPS timed out">Move to an open area. We keep trying.</Note>
  if (state === 'requesting' || (state === 'tracking' && ageSec == null)) return <Note tone="neutral" title="Waiting for the first GPS fix">Approve the browser prompt if it appears.</Note>
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-semibold text-success">Receiving location</span>
        {accuracy != null && <span className="text-muted-foreground">Accuracy ±{accuracy} m</span>}
        {ageSec != null && <span className="text-muted-foreground">Last fix {ageSec < 5 ? 'just now' : `${ageSec} sec ago`}</span>}
      </div>
      {lost && (
        <Note tone="warning" title="Location temporarily unavailable">
          Riders don't see a position until a new fix arrives.
        </Note>
      )}
      {serverError && (
        <Note tone="warning" title="Location not accepted" icon={<MapPinOff />}>
          {serverError}
        </Note>
      )}
    </div>
  )
}

function Note({ tone, title, children, icon }: { tone: 'danger' | 'warning' | 'neutral'; title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div role="status" className={cn('flex items-start gap-3 rounded-xl border p-3 text-sm', tone === 'danger' ? 'border-danger/30 bg-danger/10' : tone === 'warning' ? 'border-warning/30 bg-warning/10' : 'border-white/10 bg-white/5')}>
      {icon && <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span>}
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}

