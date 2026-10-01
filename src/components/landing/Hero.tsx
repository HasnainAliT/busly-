import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LiveDot } from '@/components/ui/live-dot'
import { useBuses, useTransit } from '@/hooks/useLiveFeed'
import { useDemoLogin } from '@/hooks/useDemoLogin'
import { HeroArt } from '@/components/landing/HeroArt'
import { SearchCard } from '@/components/landing/SearchCard'

const rise = (delay: number) => ({ initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const } })

export function Hero() {
  const { insights, status } = useBuses()
  const { routes } = useTransit()
  const demo = useDemoLogin()
  const live = insights.filter((i) => i.bus.status === 'active' || i.bus.status === 'delayed').length

  return (
    <section className="px-3 pb-6 pt-2 sm:px-5 lg:px-8" aria-labelledby="hero-title">
      <div className="relative mx-auto max-w-[1400px]">
        <div className="relative isolate overflow-hidden rounded-[28px] bg-[hsl(161_62%_12%)] sm:rounded-[36px]">
          <HeroArt className="absolute inset-0 -z-10 size-full" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[hsl(165_60%_8%/.78)] via-[hsl(165_60%_8%/.35)] to-transparent" aria-hidden />
          <div className="px-6 pb-36 pt-14 sm:px-12 sm:pb-40 sm:pt-20 lg:px-16 lg:pb-44 lg:pt-28">
            <motion.p {...rise(0)} className="inline-flex items-center gap-2.5 rounded-full border border-white/0 bg-[hsl(45_40%_97%/.14)] py-1.5 pl-3 pr-4 text-[13px] font-medium text-[hsl(45_40%_97%)] backdrop-blur">
              <LiveDot tone={status === 'live' ? 'success' : 'muted'} />
              {live} buses live across {routes.length} routes
            </motion.p>
            <motion.h1 id="hero-title" {...rise(0.06)} className="mt-6 max-w-3xl text-balance font-display text-[2.6rem] font-medium leading-[1.04] text-[hsl(45_40%_97%)] sm:text-6xl lg:text-[4.5rem]">
              Know where your bus is before you leave.
            </motion.h1>
            <motion.p {...rise(0.14)} className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-[hsl(45_30%_90%/.9)] sm:text-lg">
              Live positions, honest arrival times and service alerts for campus and city routes in Jamshoro, Kotri and Hyderabad. Share a trip with a QR code.
            </motion.p>
            <motion.div {...rise(0.22)} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={demo.start} disabled={demo.pending} className="w-full bg-[hsl(45_40%_97%)] text-primary shadow-lift hover:bg-white sm:w-auto">
                <Play className="fill-current" /> {demo.pending ? 'Opening demo...' : 'Try the live demo'}
              </Button>
              <Button asChild size="lg" variant="ghost" className="w-full border border-[hsl(45_40%_97%/.35)] text-[hsl(45_40%_97%)] hover:bg-[hsl(45_40%_97%/.12)] hover:text-white sm:w-auto">
                <Link to="/signup">
                  Create an account <ArrowRight />
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
        <motion.div {...rise(0.3)} className="relative z-10 -mt-20 px-2 sm:-mt-24 sm:px-8">
          <SearchCard />
        </motion.div>
      </div>
    </section>
  )
}
