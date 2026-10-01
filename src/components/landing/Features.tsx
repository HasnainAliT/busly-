import { BellRing, Gauge, LocateFixed, QrCode, Route as RouteIcon, Smartphone } from 'lucide-react'
import { Reveal } from '@/components/landing/Reveal'

const features = [
  { icon: LocateFixed, title: 'Live positions and ETAs', text: 'Every bus on the map with an arrival time that accounts for distance, speed and delay. When a signal drops we say so instead of showing stale numbers.' },
  { icon: RouteIcon, title: 'Transfers and fares', text: 'No direct bus? Busly proposes a route with one change, the wait at the interchange and the total fare.' },
  { icon: BellRing, title: 'Alerts that matter', text: 'Operators publish closures and delays. Riders see them on the map, at the stop and in their notifications.' },
  { icon: QrCode, title: 'QR trip links', text: 'Every bus carries a code. Scan it to follow that bus, or share a live link with someone waiting for you.' },
  { icon: Gauge, title: 'Explainable insights', text: 'Delay patterns, unusual trips and schedule suggestions come with the reason and the numbers behind them.' },
  { icon: Smartphone, title: 'Driver app on a phone', text: 'Start a trip, share phone GPS, report traffic or a blocked road. No extra hardware.' },
]

export function Features() {
  return (
    <section id="product" className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">What you get</p>
          <h2 className="mt-3 text-balance font-display text-3xl font-medium sm:text-5xl">One platform for riders, drivers and operators</h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">Everything connects to the same live data, so a driver's report becomes a rider's alert within seconds.</p>
        </Reveal>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <li key={f.title}>
              <Reveal delay={i * 0.05} className="glass group h-full rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift sm:p-7">
                <span className="grid size-12 place-items-center rounded-2xl bg-accent text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-5 font-display text-xl font-medium">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{f.text}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
