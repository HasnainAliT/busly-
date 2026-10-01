import { useState, type FormEvent } from 'react'
import { Plus, ShieldCheck } from 'lucide-react'
import { Panel, SelectField } from '@/components/ui/form'
import { Field } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Switch } from '@/components/ui/switch'
import { useTransit } from '@/hooks/useLiveFeed'
import { useDispatch } from '@/hooks/useDispatch'
import { useAuth } from '@/context/AuthContext'
import { ROLE_CAPABILITIES } from '@/domain/engine'
import type { Role } from '@/types'

/** 14 random characters from the browser's CSPRNG, always containing a letter, a digit and a symbol. */
function tempPassword() {
  const sets = ['abcdefghjkmnpqrstuvwxyz', 'ABCDEFGHJKMNPQRSTUVWXYZ', '23456789', '#$%&*?']
  const all = sets.join('')
  const rnd = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n
  const chars = sets.map((s) => s[rnd(s.length)])
  while (chars.length < 14) chars.push(all[rnd(all.length)])
  return chars.sort(() => rnd(3) - 1).join('')
}

const roles: Role[] = ['rider', 'driver', 'operator', 'admin']

export default function Users() {
  const { users } = useTransit()
  const { user: me } = useAuth()
  const { run, pending } = useDispatch()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', email: '', role: 'driver' as Role })
  const [err, setErr] = useState<string | null>(null)
  const [tempPw, setTempPw] = useState<string | null>(null)

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (f.name.trim().length < 2) return setErr('Enter a name.')
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Enter a valid email.')
    const password = tempPassword()
    const r = await run({ type: 'user/create', name: f.name.trim(), email: f.email.trim(), role: f.role }, { quiet: true, extra: { password } })
    if (!r.ok) return setErr(r.message)
    setOpen(false)
    setTempPw(password)
    setF({ name: '', email: '', role: 'driver' })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Users and roles</h1>
        <Button onClick={() => setOpen(true)}><Plus /> Add user</Button>
      </div>
      {tempPw && <p role="status" className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm">User created. Temporary password: <code className="font-mono font-bold">{tempPw}</code>. Share it privately, it is shown once.</p>}

      <Panel title={`Accounts (${users.length})`}>
        <ul className="divide-y divide-white/8" aria-label="Users">
          {users.map((u) => (
            <li key={u.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold">{u.name} {u.id === me?.id && <Badge tone="primary">You</Badge>}{!u.active && <Badge tone="muted">Disabled</Badge>}</p>
                <p className="truncate text-sm text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <select aria-label={`Role for ${u.name}`} className="h-9 rounded-lg border border-white/10 bg-white/5 px-2.5 text-sm capitalize" value={u.role} disabled={pending || u.id === me?.id} onChange={(e) => void run({ type: 'user/setRole', userId: u.id, role: e.target.value as Role }, { success: 'Role updated' })}>
                  {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm">Active <Switch checked={u.active} disabled={pending || u.id === me?.id} aria-label={`Active: ${u.name}`} onCheckedChange={(v) => void run({ type: 'user/setActive', userId: u.id, active: v }, { success: v ? 'Account enabled' : 'Account disabled' })} /></label>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="What each role can do" action={<ShieldCheck className="size-4 text-muted-foreground" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          {roles.map((r) => (
            <div key={r} className="rounded-xl border border-white/8 bg-white/4 p-3.5">
              <p className="font-semibold capitalize">{r}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{ROLE_CAPABILITIES[r].map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          ))}
        </div>
      </Panel>

      <Modal open={open} onOpenChange={(o) => { setOpen(o); if (!o) setErr(null) }} title="Add user" description="A temporary password is generated for the new account.">
        <form onSubmit={create} className="space-y-4 p-5" noValidate>
          <Field label="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Field label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <SelectField label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{roles.map((r) => <option key={r} value={r}>{r}</option>)}</SelectField>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <Button type="submit" className="w-full" disabled={pending}>Create user</Button>
        </form>
      </Modal>
    </div>
  )
}
