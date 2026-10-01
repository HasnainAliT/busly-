import { ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/landing/Reveal'
import { demoAccounts, useDemoLogin } from '@/hooks/useDemoLogin'
import { HeroArt } from '@/components/landing/HeroArt'
import { ROLE_CAPABILITIES } from '@/domain/engine'
import type { Role } from '@/types'

const roles: { role: Role; title: string; blurb: string }[] = [
  { role: 'rider', title: 'Passengers', blurb: 'Plan, track and get told when something changes.' },
  { role: 'driver', title: 'Drivers', blurb: 'Run a trip from a phone and report problems in one tap.' },
  { role: 'operator', title: 'Operators', blurb: 'Manage the fleet, publish alerts and read the analytics.' },
]

function RoleCard({ role, title, blurb, delay }: (typeof roles)[number] & { delay: number }) {
  const demo = useDemoLogin(role)
  return (
    <Reveal delay={delay} className="flex h-full flex-col rounded-3xl border border-[hsl(45_40%_97%/.12)] bg-[hsl(45_40%_97%/.06)] p-6 backdrop-blur sm:p-7">
      <h3 className="font-display text-2xl font-medium text-[hsl(45_40%_97%)]">{title}</h3>
      <p className="mt-2 text-[15px] text-[hsl(45_30%_90%/.8)]">{blurb}</p>
      <ul className="mt-5 flex-1 space-y-2.5 text-sm text-[hsl(45_30%_92%)]">
        {ROLE_CAPABILITIES[role].slice(0, 4).map((c) => (
          <li key={c} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-[hsl(150_55%_70%)]" aria-hidden /> {c}</li>
        ))}
      </ul>
      <Button onClick={demo.start} disabled={demo.pending} className="mt-6 w-full bg-[hsl(45_40%_97%)] text-primary hover:bg-white">
        {demo.pending ? 'Opening...' : `Open as ${demoAccounts[role].label.toLowerCase()}`} <ArrowRight />
      </Button>
    </Reveal>
  )
}

export function DemoTour() {
  return (
    <section id="tour" className="scroll-mt-20 px-3 py-10 sm:px-5 sm:py-16 lg:px-8">
      <div className="relative isolate mx-auto max-w-[1400px] overflow-hidden rounded-[28px] bg-[hsl(161_62%_12%)] sm:rounded-[36px]">
        <HeroArt className="absolute inset-x-0 bottom-0 -z-10 h-full w-full opacity-25" />
        <div className="px-6 py-14 sm:px-12 sm:py-20 lg:px-16">
          <Reveal className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(150_55%_70%)]">Try it as anyone</p>
            <h2 className="mt-3 text-balance font-display text-3xl font-medium text-[hsl(45_40%_97%)] sm:text-5xl">Three roles, one live system</h2>
            <p className="mt-4 text-pretty text-[hsl(45_30%_90%/.85)] sm:text-lg">Each button opens the real app with demo data. Open two roles side by side and watch a driver's report reach a rider.</p>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {roles.map((r, i) => (
              <RoleCard key={r.role} {...r} delay={i * 0.07} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function FinalCta() {
  const demo = useDemoLogin()
  return (
    <section className="px-4 pb-16 pt-6 sm:px-6 sm:pb-24 lg:px-8">
      <Reveal className="glass-strong mx-auto max-w-5xl rounded-[32px] px-6 py-12 text-center sm:px-12 sm:py-16">
        <h2 className="text-balance font-display text-3xl font-medium sm:text-5xl">Your next bus is already on its way</h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground sm:text-lg">Open the demo to follow a live bus, scan its code and plan a trip.</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={demo.start} disabled={demo.pending} className="w-full sm:w-auto">
            {demo.pending ? 'Opening demo...' : 'Try the live demo'}
          </Button>
        </div>
      </Reveal>
    </section>
  )
}
