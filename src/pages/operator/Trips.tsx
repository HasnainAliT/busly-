import { Panel } from '@/components/ui/form'
import { Badge } from '@/components/ui/badge'
import { StateCard } from '@/components/ui/states'
import { useTransit } from '@/hooks/useLiveFeed'
import { useDispatch } from '@/hooks/useDispatch'
import { ConfirmButton } from './shared'
import { dayTime } from './time'
import { actualMinutes } from '@/domain/analytics'
import type { TripStatus } from '@/types'

const tone: Record<TripStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  'on-route': 'success', delayed: 'warning', 'temporary-stop': 'warning', completed: 'neutral', cancelled: 'danger', 'ended-vehicle-issue': 'danger',
}
const label: Record<TripStatus, string> = {
  'on-route': 'On route', delayed: 'Delayed', 'temporary-stop': 'Temporary stop', completed: 'Completed', cancelled: 'Cancelled', 'ended-vehicle-issue': 'Ended: vehicle issue',
}

export default function Trips() {
  const { trips, routes, buses, drivers } = useTransit()
  const { run, pending } = useDispatch()
  const sorted = [...trips].sort((a, b) => b.startTime - a.startTime)
  const live = sorted.filter((t) => t.endTime == null)
  const history = sorted.filter((t) => t.endTime != null).slice(0, 30)

  const row = (t: (typeof trips)[number], cancel: boolean) => (
    <li key={t.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          Bus {buses.find((b) => b.id === t.busId)?.busNumber ?? t.busId} · Route {routes.find((r) => r.id === t.routeId)?.code ?? '-'}
          <Badge tone={tone[t.status]}>{label[t.status]}</Badge>
          {t.sample && <Badge tone="muted">Sample</Badge>}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {drivers.find((d) => d.id === t.driverId)?.name ?? 'Fleet bus'} · {dayTime(t.startTime)}
          {t.endTime != null ? ` · ${Math.round(actualMinutes(t))} min` : ''} · delay {t.delayMinutes} min · {t.locSource === 'gps' ? 'Phone GPS' : 'Simulated GPS'}
        </p>
      </div>
      {cancel && <ConfirmButton label="Cancel trip" confirmLabel="Yes, cancel" disabled={pending} onConfirm={() => void run({ type: 'trip/cancel', tripId: t.id, reason: 'Cancelled by operator' }, { success: 'Trip cancelled, riders notified' })} />}
    </li>
  )

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Trips</h1>
      <Panel title={`In progress (${live.length})`}>
        {live.length === 0 ? <StateCard title="No trips in progress" description="Trips appear here as soon as a driver starts one." /> : <ul className="divide-y divide-white/8" aria-label="Trips in progress">{live.map((t) => row(t, true))}</ul>}
      </Panel>
      <Panel title="History">
        <ul className="divide-y divide-white/8" aria-label="Trip history">{history.map((t) => row(t, false))}</ul>
      </Panel>
    </div>
  )
}
