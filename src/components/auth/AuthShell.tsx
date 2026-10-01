import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, MapPin, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { LiveDot } from '@/components/ui/live-dot'
import { HeroArt } from '@/components/landing/HeroArt'

/** Shared frame for login, sign up and password reset: a scenic panel beside a calm form. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative m-3 hidden overflow-hidden rounded-[2rem] bg-[#0B3328] lg:block" aria-hidden>
        <HeroArt className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B3328]/70 via-transparent to-[#0B3328]/60" />
        <div className="relative flex h-full flex-col justify-between p-10 text-[#F4F1EA]">
          <Link to="/" tabIndex={-1} className="[&_span]:text-[#F4F1EA]">
            <Logo />
          </Link>
          <div className="max-w-md space-y-6">
            <h2 className="text-balance font-display text-4xl leading-tight">Your bus, on your screen, before it reaches the stop.</h2>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-3 rounded-2xl border border-white/20 bg-[#0B3328]/60 p-4 backdrop-blur-md">
              <div className="flex items-center justify-between text-sm">
                <span className="font-display font-semibold">BUS-104</span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#BFE8D4]">
                  <LiveDot /> On route
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-[#F4F1EA]/80">
                <MapPin className="size-4 text-[#BFE8D4]" /> Next stop: MUET Main Gate
              </div>
              <div className="flex items-center gap-2.5 text-sm text-[#F4F1EA]/80">
                <Clock className="size-4 text-[#BFE8D4]" /> Arrives in 4 min
              </div>
            </motion.div>
          </div>
          <p className="flex items-center gap-2 text-sm text-[#F4F1EA]/80">
            <ShieldCheck className="size-4 text-[#BFE8D4]" /> Passwords are hashed. Sessions use secure cookies.
          </p>
        </div>
      </aside>

      <main className="relative flex flex-col px-4 py-6 sm:px-8">
        <div className="lg:hidden">
          <Link to="/" aria-label="Busly home">
            <Logo />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="w-full max-w-[420px]">
            <h1 className="font-display text-4xl leading-tight">{title}</h1>
            <p className="mt-2 text-muted-foreground">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
          </motion.div>
        </div>
      </main>
    </div>
  )
}

export function FormAlert({ tone, children }: { tone: 'danger' | 'warning' | 'success'; children: ReactNode }) {
  const cls = { danger: 'border-danger/30 bg-danger/10 text-danger', warning: 'border-warning/30 bg-warning/10 text-warning', success: 'border-success/30 bg-success/10 text-success' }[tone]
  return (
    <div role={tone === 'success' ? 'status' : 'alert'} className={`rounded-lg border px-3.5 py-3 text-sm leading-snug ${cls}`}>
      {children}
    </div>
  )
}
