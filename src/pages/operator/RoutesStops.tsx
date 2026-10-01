import { useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Ban, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Panel, SelectField } from '@/components/ui/form'
import { Field } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Switch } from '@/components/ui/switch'
import { useTransit } from '@/hooks/useLiveFeed'
import { useDispatch } from '@/hooks/useDispatch'
import { ConfirmButton } from './shared'
import type { Route, Stop } from '@/types'

interface RDraft { id?: string; code: string; name: string; stopIds: string[]; durationMin: string; frequencyMin: string; firstDeparture: string; lastDeparture: string; fare: string; active: boolean }
interface SDraft { id?: string; name: string; lat: string; lng: string; kind: Stop['kind'] }
const kinds: Stop['kind'][] = ['station', 'campus', 'hospital', 'bridge', 'terminal', 'interchange', 'town']

export default function RoutesStops() {
  const { routes, stops } = useTransit()
  const { run, pending } = useDispatch()
  const [rd, setRd] = useState<RDraft | null>(null)
  const [sd, setSd] = useState<SDraft | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [closing, setClosing] = useState<{ stop: Stop; reason: string } | null>(null)
  const name = (id: string) => stops.find((s) => s.id === id)?.name ?? id

  const editRoute = (r?: Route) => {
    setErr(null)
    setRd(r ? { id: r.id, code: r.code, name: r.name, stopIds: [...r.stopIds], durationMin: String(r.durationMin), frequencyMin: String(r.frequencyMin), firstDeparture: r.firstDeparture, lastDeparture: r.lastDeparture, fare: String(r.fare), active: r.active } : { code: '', name: '', stopIds: [], durationMin: '30', frequencyMin: '15', firstDeparture: '06:00', lastDeparture: '22:00', fare: '60', active: true })
  }
  const saveRoute = async (e: FormEvent) => {
    e.preventDefault()
    if (!rd) return
    const nums = { durationMin: Number(rd.durationMin), frequencyMin: Number(rd.frequencyMin), fare: Number(rd.fare) }
    if (!rd.code.trim() || !rd.name.trim()) return setErr('Route code and name are required.')
    if (rd.stopIds.length < 2) return setErr('Pick at least two stops, in travel order.')
    if (Object.values(nums).some((n) => !Number.isFinite(n) || n <= 0)) return setErr('Duration, frequency and fare must be positive numbers.')
    const route = { code: rd.code.trim(), name: rd.name.trim(), from: name(rd.stopIds[0]), to: name(rd.stopIds[rd.stopIds.length - 1]), stopIds: rd.stopIds, ...nums, firstDeparture: rd.firstDeparture, lastDeparture: rd.lastDeparture, active: rd.active }
    const r = await run(rd.id ? { type: 'route/update', routeId: rd.id, patch: route } : { type: 'route/create', route }, { success: rd.id ? 'Route updated' : 'Route created', quiet: true })
    if (r.ok) setRd(null)
    else setErr(r.message)
  }
  const move = (i: number, d: -1 | 1) => {
    if (!rd) return
    const a = [...rd.stopIds]
    const j = i + d
    if (j < 0 || j >= a.length) return
    ;[a[i], a[j]] = [a[j], a[i]]
    setRd({ ...rd, stopIds: a })
  }

  const editStop = (s?: Stop) => { setErr(null); setSd(s ? { id: s.id, name: s.name, lat: String(s.lat), lng: String(s.lng), kind: s.kind } : { name: '', lat: '24.90', lng: '67.08', kind: 'station' }) }
  const saveStop = async (e: FormEvent) => {
    e.preventDefault()
    if (!sd) return
    const lat = Number(sd.lat), lng = Number(sd.lng)
    if (!sd.name.trim()) return setErr('Stop name is required.')
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return setErr('Enter valid latitude and longitude.')
    const stop = { name: sd.name.trim(), lat, lng, kind: sd.kind }
    const r = await run(sd.id ? { type: 'stop/update', stopId: sd.id, patch: stop } : { type: 'stop/create', stop }, { success: sd.id ? 'Stop updated' : 'Stop added', quiet: true })
    if (r.ok) setSd(null)
    else setErr(r.message)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Routes and stops</h1>
        <div className="flex gap-2">
          <Button variant="glass" onClick={() => editStop()}><Plus /> Add stop</Button>
          <Button onClick={() => editRoute()}><Plus /> Add route</Button>
        </div>
      </div>

      <Panel title={`Routes (${routes.length})`}>
        <ul className="divide-y divide-white/8" aria-label="Routes">
          {routes.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 py-3.5 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <span className="inline-block size-2.5 rounded-full" style={{ background: `hsl(${r.hue} 85% 60%)` }} aria-hidden />
                  {r.code} · {r.name} {!r.active && <Badge tone="muted">Inactive</Badge>}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{r.stopIds.length} stops · every {r.frequencyMin} min · {r.firstDeparture} to {r.lastDeparture} · PKR {r.fare}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="glass" onClick={() => editRoute(r)}><Pencil /> Edit</Button>
                <ConfirmButton label="Delete" icon={<Trash2 />} disabled={pending} onConfirm={() => void run({ type: 'route/delete', routeId: r.id }, { success: 'Route deleted' })} />
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={`Stops (${stops.length})`}>
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Stops">
          {stops.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/4 p-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.kind}{s.closed ? ` · closed${s.closedReason ? `: ${s.closedReason}` : ''}` : ''}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {s.closed ? (
                  <Button size="sm" variant="glass" onClick={() => void run({ type: 'stop/close', stopId: s.id, closed: false }, { success: 'Stop reopened' })}>Reopen</Button>
                ) : (
                  <Button size="icon-sm" variant="glass" aria-label={`Close ${s.name}`} title="Close stop" onClick={() => setClosing({ stop: s, reason: '' })}><Ban /></Button>
                )}
                <Button size="icon-sm" variant="glass" aria-label={`Edit ${s.name}`} onClick={() => editStop(s)}><Pencil /></Button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Modal open={!!rd} onOpenChange={(o) => !o && setRd(null)} title={rd?.id ? 'Edit route' : 'Add route'} className="max-w-xl">
        {rd && (
          <form onSubmit={saveRoute} className="space-y-4 overflow-y-auto p-5" noValidate>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Code" value={rd.code} onChange={(e) => setRd({ ...rd, code: e.target.value })} />
              <Field label="Name" className="col-span-2" value={rd.name} onChange={(e) => setRd({ ...rd, name: e.target.value })} />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">Stops in order</p>
              <ol className="space-y-1.5" aria-label="Route stops">
                {rd.stopIds.map((id, i) => (
                  <li key={id + i} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-sm">
                    <span className="w-5 text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{name(id)}</span>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Move ${name(id)} up`} onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp /></Button>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Move ${name(id)} down`} onClick={() => move(i, 1)} disabled={i === rd.stopIds.length - 1}><ArrowDown /></Button>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove ${name(id)}`} onClick={() => setRd({ ...rd, stopIds: rd.stopIds.filter((_, k) => k !== i) })}><X /></Button>
                  </li>
                ))}
              </ol>
              <SelectField label="Add a stop" className="mt-3" value="" onChange={(e) => e.target.value && setRd({ ...rd, stopIds: [...rd.stopIds, e.target.value] })}>
                <option value="">Choose a stop...</option>
                {stops.filter((s) => !rd.stopIds.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </SelectField>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Minutes" inputMode="numeric" value={rd.durationMin} onChange={(e) => setRd({ ...rd, durationMin: e.target.value })} />
              <Field label="Every (min)" inputMode="numeric" value={rd.frequencyMin} onChange={(e) => setRd({ ...rd, frequencyMin: e.target.value })} />
              <Field label="Fare (PKR)" inputMode="numeric" value={rd.fare} onChange={(e) => setRd({ ...rd, fare: e.target.value })} />
              <Field label="First bus" type="time" value={rd.firstDeparture} onChange={(e) => setRd({ ...rd, firstDeparture: e.target.value })} />
              <Field label="Last bus" type="time" value={rd.lastDeparture} onChange={(e) => setRd({ ...rd, lastDeparture: e.target.value })} />
            </div>
            <label className="flex items-center justify-between gap-3 text-sm font-medium">Route is in service <Switch checked={rd.active} onCheckedChange={(v) => setRd({ ...rd, active: v })} /></label>
            {err && <p role="alert" className="text-sm text-danger">{err}</p>}
            <Button type="submit" className="w-full" disabled={pending}>{rd.id ? 'Save changes' : 'Create route'}</Button>
          </form>
        )}
      </Modal>

      <Modal open={!!sd} onOpenChange={(o) => !o && setSd(null)} title={sd?.id ? 'Edit stop' : 'Add stop'}>
        {sd && (
          <form onSubmit={saveStop} className="space-y-4 p-5" noValidate>
            <Field label="Stop name" value={sd.name} onChange={(e) => setSd({ ...sd, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude" inputMode="decimal" value={sd.lat} onChange={(e) => setSd({ ...sd, lat: e.target.value })} />
              <Field label="Longitude" inputMode="decimal" value={sd.lng} onChange={(e) => setSd({ ...sd, lng: e.target.value })} />
            </div>
            <SelectField label="Type" value={sd.kind} onChange={(e) => setSd({ ...sd, kind: e.target.value as Stop['kind'] })}>
              {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
            </SelectField>
            {err && <p role="alert" className="text-sm text-danger">{err}</p>}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={pending}>{sd.id ? 'Save changes' : 'Add stop'}</Button>
              {sd.id && <ConfirmButton label="Delete" icon={<Trash2 />} onConfirm={async () => { const r = await run({ type: 'stop/delete', stopId: sd.id! }, { success: 'Stop deleted', quiet: true }); if (r.ok) setSd(null); else setErr(r.message) }} />}
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!closing} onOpenChange={(o) => !o && setClosing(null)} title="Close stop" description="Riders will see a service alert and the stop will show as closed.">
        {closing && (
          <form className="space-y-4 p-5" onSubmit={async (e) => { e.preventDefault(); const r = await run({ type: 'stop/close', stopId: closing.stop.id, closed: true, reason: closing.reason.trim() || 'Temporarily closed' }, { success: 'Stop closed, riders notified' }); if (r.ok) setClosing(null) }}>
            <p className="text-sm">{closing.stop.name}</p>
            <Field label="Reason" value={closing.reason} onChange={(e) => setClosing({ ...closing, reason: e.target.value })} placeholder="e.g. Road work" />
            <Button type="submit" className="w-full" disabled={pending}>Close stop</Button>
          </form>
        )}
      </Modal>
    </div>
  )
}
