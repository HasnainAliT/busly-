import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Check, KeyRound, LogOut, MapPin, Pencil, ShieldCheck, Timer, Trash2, UserCog, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActivityTimeline } from '@/components/ui/timeline'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { SecurityOverview } from '@/components/security/SecurityOverview'
import { demoAccounts } from '@/hooks/useDemoLogin'
import { ROLE_CAPABILITIES } from '@/domain/engine'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/context/AuthContext'
import { useLocationAccess } from '@/context/LocationContext'
import { useUserData } from '@/context/UserDataContext'
import { useNow } from '@/hooks/useLiveFeed'
import { validateName } from '@/utils/security'

function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="glass scroll-mt-24 rounded-2xl p-5 sm:p-6" aria-labelledby={id ? `${id}-title` : undefined}>
      <h2 id={id ? `${id}-title` : undefined} className="font-display text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function SettingRow({ icon, title, text, control }: { icon: React.ReactNode; title: string; text: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/6 text-primary [&_svg]:size-[18px]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{text}</p>
      </div>
      {control}
    </div>
  )
}

export default function ProfilePage() {
  const { user, logout, updateName, sessionExpiresAt, mode } = useAuth()
  const loc = useLocationAccess()
  const { clearRecents } = useUserData()
  const toast = useToast()
  const now = useNow(1000)
  const { hash } = useLocation()

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [nameError, setNameError] = useState<string | null>(null)
  const [alertsOn, setAlertsOn] = useState(true)

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  if (!user) return null

  const remaining = Math.max(0, Math.round(((sessionExpiresAt ?? now) - now) / 1000))
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  const saveName = (e: FormEvent) => {
    e.preventDefault()
    const err = validateName(name)
    setNameError(err)
    if (err) return
    updateName(name)
    setEditing(false)
    toast({ title: 'Name updated', tone: 'success' })
  }

  const clearLocal = () => {
    clearRecents()
    toast({ title: 'Recent searches and buses cleared', tone: 'success' })
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 md:px-8 md:py-8">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Profile</h1>

      <section className="glass rounded-2xl p-5 sm:p-6" aria-label="Account">
        <div className="flex items-start gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-secondary font-display text-2xl font-bold text-primary-foreground" aria-hidden>
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            {editing ? (
              <form onSubmit={saveName} className="space-y-2">
                <label htmlFor="display-name" className="sr-only">Display name</label>
                <div className="flex gap-2">
                  <Input id="display-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} invalid={!!nameError} autoFocus autoComplete="name" />
                  <Button type="submit" size="icon" aria-label="Save name"><Check /></Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Cancel" onClick={() => { setEditing(false); setName(user.name); setNameError(null) }}><X /></Button>
                </div>
                {nameError && <p role="alert" className="text-[13px] text-danger">{nameError}</p>}
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="truncate font-display text-xl font-bold">{user.name}</h2>
                <button onClick={() => setEditing(true)} aria-label="Edit name" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-white/10 hover:text-foreground"><Pencil className="size-4" /></button>
              </div>
            )}
            <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone="primary"><UserCog className="size-3" /> {demoAccounts[user.role].label}</Badge>
              <Badge tone="success"><ShieldCheck className="size-3" /> Secure session</Badge>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 border-t border-white/8 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Timer className="size-4" /> {sessionExpiresAt ? <>Session expires in <span className="font-semibold tabular-nums text-foreground">{mm}:{ss}</span></> : 'Your session ends after 30 minutes without activity.'}</p>
          <Button variant="outline" onClick={logout}><LogOut /> Sign out</Button>
        </div>
      </section>

      <Section id="activity" title="Your activity" description="Searches, saved items and sign-ins. Stored with your account when the server is connected.">
        <ActivityTimeline limit={8} />
      </Section>

      <Section id="privacy" title="Privacy controls" description="Choose what Busly can use. These settings stay on this device.">
        <div className="divide-y divide-white/8">
          <SettingRow
            icon={<MapPin />}
            title="Use my location"
            text={loc.state === 'denied' ? 'Location access is disabled. Nearby buses use a campus point instead.' : 'Used only to sort buses by distance. It is not stored.'}
            control={<Switch checked={loc.state !== 'denied'} onCheckedChange={(on) => (on ? loc.request() : loc.disable())} aria-label="Use my location" />}
          />
          <SettingRow icon={<KeyRound />} title="Arrival alerts" text="Notify me when a saved bus is approaching." control={<Switch checked={alertsOn} onCheckedChange={setAlertsOn} aria-label="Arrival alerts" />} />
          <SettingRow icon={<Trash2 />} title="Recent searches and buses" text="Remove the history saved in this browser." control={<Button variant="outline" size="sm" onClick={clearLocal}>Clear</Button>} />
        </div>
      </Section>

      <Section title="Security and privacy" description="What is built and tested, and what still needs hosting.">
        <SecurityOverview />
      </Section>

      <Section title="What your role can do" description={mode === 'api' ? 'Roles are checked by the server on every request.' : 'Demo mode: roles are enforced in the browser only. Run the server to enforce them for real.'}>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {ROLE_CAPABILITIES[user.role].map((c) => (
            <li key={c} className="flex items-start gap-2 rounded-lg bg-white/4 px-3 py-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              {c}
            </li>
          ))}
        </ul>
        {user.role !== 'rider' && (
          <Button asChild className="mt-4">
            <Link to={user.role === 'driver' ? '/driver' : '/operator'}>Open the {user.role === 'driver' ? 'driver app' : 'operations console'}</Link>
          </Button>
        )}
      </Section>
    </div>
  )
}
