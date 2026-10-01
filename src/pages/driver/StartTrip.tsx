import { useMemo, useState } from 'react'
import { BusFront, Play, Satellite, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/form'
import { StateCard } from '@/components/ui/states'
import { useDispatch } from '@/hooks/useDispatch'
import { cn } from '@/lib/utils'
import type { BusRecord, Driver, LocationSource, Route } from '@/types'

interface Props {
  driver: Driver
  buses: BusRecord[]
  routes: Route[]
  simSpeed: number
}

const sources: { id: LocationSource; title: string; text: string; icon: typeof Satellite }[] = [
  { id: 'simulated', title: 'Simulated GPS', text: 'The bus moves along the route by itself. Riders see a "Simulated GPS" label. Use this when you are not travelling.', icon: Satellite },
  { id: 'gps', title: 'Phone GPS', text: "Uses this phone's location while the trip runs. Needs location permission, and works on https or localhost only.", icon: Smartphone },
]

export function StartTrip({ driver, buses, routes, simSpeed }: Props) {
  const eligible = useMemo(() => buses.filter((b) => b.status === 'available' && (b.driverId === driver.id || !b.driverId)), [buses, driver.id])
  const [busId, setBusId] = useState('')
  const [routeId, setRouteId] = useState('')
  const [source, setSource] = useState<LocationSource>('simulated')
  const [error, setError] = useState<string | null>(null)
  const { run, pending } = useDispatch()

  const selectedBus = eligible.find((b) => b.id === busId) ?? eligible.find((b) => b.id === driver.assignedBusId) ?? eligible[0]
  const activeRoutes = routes.filter((r) => r.active)
  const effectiveRoute = routeId || selectedBus?.routeId || ''

  if (!eligible.length) {
    return (
      <StateCard
        icon={<BusFront />}
        title="No bus is ready for you"
        description="Your assigned bus is already out, offline or on a break. Ask the operator to assign you an available bus, then check back."
      />
    )
  }

  const start = async () => {
    if (!selectedBus) return
    setError(null)
    const r = await run({ type: 'trip/start', busId: selectedBus.id, routeId: effectiveRoute, source }, { success: 'Trip started', quiet: true })
    if (!r.ok) setError(r.message)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void start()
      }}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Bus" value={selectedBus?.id ?? ''} onChange={(e) => { setBusId(e.target.value); setRouteId('') }}>
          {eligible.map((b) => (
            <option key={b.id} value={b.id}>
              {b.id} · {b.model}
              {b.driverId === driver.id ? ' (assigned to you)' : ''}
            </option>
          ))}
        </SelectField>
        <SelectField label="Route" value={effectiveRoute} onChange={(e) => setRouteId(e.target.value)}>
          {activeRoutes.map((r) => (
            <option key={r.id} value={r.id}>
              Route {r.code}: {r.from} to {r.to}
            </option>
          ))}
        </SelectField>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Location source</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {sources.map((s) => {
            const Icon = s.icon
            const active = source === s.id
            return (
              <label
                key={s.id}
                className={cn('flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors focus-within:ring-2 focus-within:ring-ring/60', active ? 'border-primary/60 bg-primary/10' : 'border-white/10 bg-white/4 hover:bg-white/8')}
              >
                <input type="radio" name="source" value={s.id} checked={active} onChange={() => setSource(s.id)} className="sr-only" />
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', active ? 'bg-primary/20 text-primary' : 'bg-white/8 text-muted-foreground')}>
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{s.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{s.text}</span>
                </span>
              </label>
            )
          })}
        </div>
        {source === 'simulated' && <p className="mt-2 text-[13px] text-muted-foreground">Demo clock: simulated buses run {simSpeed}x faster than real time.</p>}
      </fieldset>

      {error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending || !selectedBus}>
        <Play /> {pending ? 'Starting…' : 'Start trip'}
      </Button>
    </form>
  )
}
