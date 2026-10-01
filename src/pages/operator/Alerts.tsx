import { useState, type FormEvent } from 'react'
import { Megaphone } from 'lucide-react'
import { Panel } from '@/components/ui/form'
import { SelectField, TextareaField } from '@/components/ui/form'
import { Field } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StateCard } from '@/components/ui/states'
import { useTransit } from '@/hooks/useLiveFeed'
import { useDispatch } from '@/hooks/useDispatch'
import { dayTime } from './time'
import type { AlertKind } from '@/types'

const kinds: { v: AlertKind; l: string }[] = [
  { v: 'announcement', l: 'Announcement' },
  { v: 'delay', l: 'Delay' },
  { v: 'route-blocked', l: 'Road blocked' },
  { v: 'route-change', l: 'Route change' },
  { v: 'service-unavailable', l: 'Service unavailable' },
]

export default function Alerts() {
  const { alerts, routes, reports, buses } = useTransit()
  const { run, pending } = useDispatch()
  const [kind, setKind] = useState<AlertKind>('announcement')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [routeId, setRouteId] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const publish = async (e: FormEvent) => {
    e.preventDefault()
    if (title.trim().length < 3) return setErr('Add a short title.')
    if (body.trim().length < 3) return setErr('Add a message for riders.')
    setErr(null)
    const r = await run({ type: 'alert/publish', kind, title: title.trim(), body: body.trim(), routeId: routeId || undefined }, { success: 'Alert published to riders', quiet: true })
    if (r.ok) { setTitle(''); setBody('') } else setErr(r.message)
  }

  const active = alerts.filter((a) => a.active)
  const past = alerts.filter((a) => !a.active).slice(0, 8)
  const open = reports.filter((r) => r.status === 'open')

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Service alerts</h1>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Panel title="Publish an announcement">
          <form onSubmit={publish} className="space-y-4" noValidate>
            <SelectField label="Type" value={kind} onChange={(e) => setKind(e.target.value as AlertKind)}>
              {kinds.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
            </SelectField>
            <SelectField label="Applies to" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
              <option value="">All routes</option>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}
            </SelectField>
            <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
            <TextareaField label="Message" value={body} onChange={(e) => setBody(e.target.value)} maxLength={300} />
            {err && <p role="alert" className="text-sm text-danger">{err}</p>}
            <Button type="submit" className="w-full" disabled={pending}><Megaphone /> Publish</Button>
          </form>
        </Panel>

        <div className="space-y-4">
          <Panel title={`Active (${active.length})`}>
            {active.length === 0 ? (
              <StateCard title="No active alerts" description="Riders see alerts here and in their notifications." />
            ) : (
              <ul className="space-y-3" aria-label="Active alerts">
                {active.map((a) => (
                  <li key={a.id} className="rounded-xl border border-white/8 bg-white/4 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">{a.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                        <p className="mt-1.5 text-xs text-muted-foreground">{dayTime(a.createdAt)}{a.routeId ? ` · Route ${routes.find((r) => r.id === a.routeId)?.code ?? ''}` : ''}</p>
                      </div>
                      <Button size="sm" variant="glass" disabled={pending} onClick={() => void run({ type: 'alert/resolve', alertId: a.id }, { success: 'Alert resolved' })}>Resolve</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Rider reports (${open.length} open)`}>
            {open.length === 0 ? <p className="text-sm text-muted-foreground">No open reports.</p> : (
              <ul className="space-y-2.5">
                {open.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span><b>{r.category}</b> on bus {buses.find((b) => b.id === r.busId)?.busNumber ?? r.busId}{r.note ? ` - ${r.note}` : ''}</span>
                    <Button size="sm" variant="glass" onClick={() => void run({ type: 'issue/resolve', reportId: r.id }, { success: 'Report resolved' })}>Resolve</Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {past.length > 0 && (
            <Panel title="Recently resolved">
              <ul className="space-y-2 text-sm text-muted-foreground">{past.map((a) => <li key={a.id} className="flex justify-between gap-2"><span className="truncate">{a.title}</span><Badge tone="muted">Resolved</Badge></li>)}</ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
