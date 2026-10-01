import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownUp, MapPin, Navigation, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { placeSuggestions } from '@/utils/routeSearch'
import { sanitizeText } from '@/utils/security'

/** Floating trip search that sits on the hero's lower edge. Opens the route planner (signing in first when needed). */
export function SearchCard() {
  const navigate = useNavigate()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState<string | null>(null)

  const go = (e: FormEvent) => {
    e.preventDefault()
    const f = sanitizeText(from, 40)
    const t = sanitizeText(to, 40)
    if (f && t && f.toLowerCase() === t.toLowerCase()) return setError('Pick two different places.')
    setError(null)
    const q = new URLSearchParams()
    if (f) q.set('from', f)
    if (t) q.set('to', t)
    navigate(`/app/routes${q.toString() ? `?${q}` : ''}`)
  }

  const input = 'h-12 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-[15px] placeholder:text-muted-foreground/80 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

  return (
    <form onSubmit={go} className="glass-strong mx-auto w-full max-w-4xl rounded-3xl p-3 sm:p-4" aria-label="Plan a trip" noValidate>
      <div className="grid items-end gap-3 md:grid-cols-[1fr_auto_1fr_auto]">
        <div>
          <label htmlFor="hero-from" className="mb-1.5 block px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">From</label>
          <div className="relative">
            <Navigation className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-secondary" aria-hidden />
            <input id="hero-from" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="MUET" list="hero-places" maxLength={40} autoComplete="off" className={input} />
          </div>
        </div>
        <Button type="button" variant="outline" size="icon" className="mx-auto" aria-label="Swap from and to" onClick={() => { setFrom(to); setTo(from) }}>
          <ArrowDownUp className="md:rotate-90" />
        </Button>
        <div>
          <label htmlFor="hero-to" className="mb-1.5 block px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">To</label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-secondary" aria-hidden />
            <input id="hero-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Hyderabad" list="hero-places" maxLength={40} autoComplete="off" className={input} />
          </div>
        </div>
        <Button type="submit" size="lg" className="h-12 w-full md:w-auto">
          <Search /> Find routes
        </Button>
      </div>
      <datalist id="hero-places">
        {placeSuggestions.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      {error && <p role="alert" className="mt-2 px-1 text-[13px] text-danger">{error}</p>}
    </form>
  )
}
