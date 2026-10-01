import { Link } from 'react-router-dom'
import { ArrowUpRight, Banknote, Clock, MapPin } from 'lucide-react'
import { Reveal } from '@/components/landing/Reveal'
import { useTransit } from '@/hooks/useLiveFeed'

/** Route cards in the style of destination cards. Real routes from the live data, so nothing here is made up. */
export function PopularRoutes() {
  const { routes } = useTransit()
  const active = routes.filter((r) => r.active)
  return (
    <section id="routes" className="scroll-mt-20 py-6 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="eyebrow">Routes</p>
            <h2 className="mt-3 text-balance font-display text-3xl font-medium sm:text-5xl">Where Busly runs today</h2>
          </div>
          <Link to="/app/routes" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            See all routes <ArrowUpRight className="size-4" />
          </Link>
        </Reveal>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {active.map((r, i) => (
            <li key={r.id}>
              <Reveal delay={i * 0.06}>
                <Link to={`/app/routes?route=${r.id}`} className="glass group relative block overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="relative h-36 overflow-hidden" style={{ background: `linear-gradient(135deg, hsl(${r.hue} 45% 26%), hsl(${r.hue} 50% 14%))` }}>
                    <svg viewBox="0 0 240 144" className="absolute inset-0 size-full opacity-90" aria-hidden>
                      <path d="M-10 118 C50 96 70 126 120 90 C170 54 190 84 250 40" fill="none" stroke={`hsl(${r.hue} 70% 80%)`} strokeWidth="3" strokeLinecap="round" strokeDasharray="2 9" />
                      <circle cx="46" cy="106" r="6" fill="hsl(45 40% 97%)" />
                      <circle cx="196" cy="68" r="6" fill="hsl(45 40% 97%)" />
                    </svg>
                    <span className="absolute left-4 top-3 font-display text-5xl font-medium text-[hsl(45_40%_97%)]">{r.code}</span>
                    <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-[hsl(45_40%_97%/.16)] text-[hsl(45_40%_97%)] transition-transform group-hover:rotate-45"><ArrowUpRight className="size-4" /></span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-lg font-medium leading-snug">{r.from} to {r.to}</h3>
                    <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
                      <div className="flex items-center gap-1.5"><dt className="sr-only">Stops</dt><MapPin className="size-3.5" aria-hidden /><dd>{r.stopIds.length} stops</dd></div>
                      <div className="flex items-center gap-1.5"><dt className="sr-only">Every</dt><Clock className="size-3.5" aria-hidden /><dd>every {r.frequencyMin} min</dd></div>
                      <div className="flex items-center gap-1.5"><dt className="sr-only">Fare</dt><Banknote className="size-3.5" aria-hidden /><dd>PKR {r.fare}</dd></div>
                    </dl>
                  </div>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
