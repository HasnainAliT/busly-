import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2, UserPlus } from 'lucide-react'
import { Panel } from '@/components/ui/form'
import { SelectField } from '@/components/ui/form'
import { Field } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Switch } from '@/components/ui/switch'
import { StatusBadge } from '@/components/bus/StatusBadge'
import { useTransit } from '@/hooks/useLiveFeed'
import { useDispatch } from '@/hooks/useDispatch'
import { ConfirmButton } from './shared'
import type { BusRecord } from '@/types'

interface Draft { id?: string; routeId: string; plate: string; model: string; capacity: string; accessible: boolean }

export default function Fleet() {
  const { buses, routes, drivers } = useTransit()
  const { run, pending } = useDispatch()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [driverOpen, setDriverOpen] = useState(false)
  const [dName, setDName] = useState('')
  const [dPhone, setDPhone] = useState('')

  const openNew = () => { setErr(null); setDraft({ routeId: routes[0]?.id ?? '', plate: '', model: '', capacity: '40', accessible: false }) }
  const openEdit = (b: BusRecord) => { setErr(null); setDraft({ id: b.id, routeId: b.routeId, plate: b.plate, model: b.model, capacity: String(b.capacity), accessible: b.accessible }) }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const capacity = Number(draft.capacity)
    if (!draft.plate.trim()) return setErr('Enter the number plate.')
    if (!Number.isFinite(capacity) || capacity < 5 || capacity > 120) return setErr('Capacity must be between 5 and 120.')
    const bus = { routeId: draft.routeId, plate: draft.plate.trim(), model: draft.model.trim() || 'Bus', capacity, accessible: draft.accessible }
    const r = await run(draft.id ? { type: 'bus/update', busId: draft.id, patch: bus } : { type: 'bus/create', bus }, { success: draft.id ? 'Bus updated' : 'Bus added', quiet: true })
    if (r.ok) setDraft(null)
    else setErr(r.message)
  }

  const addDriver = async (e: FormEvent) => {
    e.preventDefault()
    if (dName.trim().length < 2) return
    const r = await run({ type: 'driver/create', name: dName.trim(), phone: dPhone.trim() }, { success: 'Driver added' })
    if (r.ok) { setDriverOpen(false); setDName(''); setDPhone('') }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Fleet</h1>
        <div className="flex gap-2">
          <Button variant="glass" onClick={() => setDriverOpen(true)}><UserPlus /> Add driver</Button>
          <Button onClick={openNew}><Plus /> Add bus</Button>
        </div>
      </div>

      <Panel title={`Buses (${buses.length})`}>
        <ul className="divide-y divide-white/8" aria-label="Buses">
          {buses.map((b) => {
            const route = routes.find((r) => r.id === b.routeId)
            const driver = drivers.find((d) => d.id === b.driverId)
            const running = b.status === 'active' || b.status === 'delayed'
            return (
              <li key={b.id} className="flex flex-col gap-3 py-3.5 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    Bus {b.busNumber} <StatusBadge status={b.status} delayMin={b.delayMin} />
                    {b.locationLost && <Badge tone="warning">Location lost</Badge>}
                    {b.accessible && <Badge tone="info">Accessible</Badge>}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{b.plate} · {b.model} · {b.capacity} seats · Route {route?.code ?? '-'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`drv-${b.id}`}>Driver for bus {b.busNumber}</label>
                  <select
                    id={`drv-${b.id}`}
                    className="h-9 rounded-lg border border-white/10 bg-white/5 px-2.5 text-sm"
                    value={driver?.id ?? ''}
                    disabled={pending || running}
                    onChange={(e) => void run({ type: 'bus/assign', busId: b.id, driverId: e.target.value || null }, { success: 'Driver assignment saved' })}
                  >
                    <option value="">No driver</option>
                    {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {!running && (
                    <select
                      aria-label={`Status for bus ${b.busNumber}`}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-2.5 text-sm"
                      value={b.status === 'break' || b.status === 'offline' ? b.status : 'available'}
                      onChange={(e) => void run({ type: 'bus/status', busId: b.id, status: e.target.value as 'available' | 'offline' | 'break' }, { success: 'Status updated' })}
                    >
                      <option value="available">Available</option>
                      <option value="break">On break</option>
                      <option value="offline">Out of service</option>
                    </select>
                  )}
                  <Button size="icon-sm" variant="glass" aria-label={`Edit bus ${b.busNumber}`} onClick={() => openEdit(b)}><Pencil /></Button>
                  <ConfirmButton label="Delete" icon={<Trash2 />} disabled={running} onConfirm={() => void run({ type: 'bus/delete', busId: b.id }, { success: 'Bus removed' })} />
                </div>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel title={`Drivers (${drivers.length})`}>
        <ul className="divide-y divide-white/8" aria-label="Drivers">
          {drivers.map((d) => {
            const bus = buses.find((b) => b.id === d.assignedBusId)
            return (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-semibold">{d.name}</p>
                  <p className="text-sm text-muted-foreground">{d.phone || 'No phone'} · {bus ? `Bus ${bus.busNumber}` : 'No bus assigned'}</p>
                </div>
                <Badge tone={d.status === 'on-duty' ? 'success' : d.status === 'break' ? 'neutral' : 'muted'}>{d.status === 'on-duty' ? 'On duty' : d.status === 'break' ? 'On break' : 'Off duty'}</Badge>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Modal open={!!draft} onOpenChange={(o) => !o && setDraft(null)} title={draft?.id ? 'Edit bus' : 'Add bus'}>
        {draft && (
          <form onSubmit={save} className="space-y-4 p-5" noValidate>
            <SelectField label="Route" value={draft.routeId} onChange={(e) => setDraft({ ...draft, routeId: e.target.value })}>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}
            </SelectField>
            <Field label="Number plate" value={draft.plate} onChange={(e) => setDraft({ ...draft, plate: e.target.value })} placeholder="e.g. KHI-4821" />
            <Field label="Model" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} placeholder="e.g. Hino AK" />
            <Field label="Capacity (seats)" inputMode="numeric" value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} />
            <label className="flex items-center justify-between gap-3 text-sm font-medium">
              Wheelchair accessible
              <Switch checked={draft.accessible} onCheckedChange={(v) => setDraft({ ...draft, accessible: v })} />
            </label>
            {err && <p role="alert" className="text-sm text-danger">{err}</p>}
            <Button type="submit" className="w-full" disabled={pending}>{draft.id ? 'Save changes' : 'Add bus'}</Button>
          </form>
        )}
      </Modal>

      <Modal open={driverOpen} onOpenChange={setDriverOpen} title="Add driver" description="Creates a driver profile. Link a login by creating a driver-role user (admin).">
        <form onSubmit={addDriver} className="space-y-4 p-5" noValidate>
          <Field label="Full name" value={dName} onChange={(e) => setDName(e.target.value)} />
          <Field label="Phone" type="tel" value={dPhone} onChange={(e) => setDPhone(e.target.value)} />
          <Button type="submit" className="w-full" disabled={pending}>Add driver</Button>
        </form>
      </Modal>
    </div>
  )
}
