import { motion } from 'framer-motion'
import { Check, CircleDashed } from 'lucide-react'
import { implemented, needsBackend, type Practice } from '@/data/securityPractices'

function Column({ title, subtitle, items, done }: { title: string; subtitle: string; items: Practice[]; done: boolean }) {
  return (
    <div className="glass rounded-2xl p-5 sm:p-6">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      <ul className="mt-5 space-y-4">
        {items.map((p) => (
          <li key={p.title} className="flex gap-3">
            <span className={done ? 'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success/18 text-success' : 'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-dashed border-white/25 text-muted-foreground'}>
              {done ? <Check className="size-3" strokeWidth={3} /> : <CircleDashed className="size-3" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{p.title}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{p.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Shared by the landing page and the Profile privacy section so the story never diverges. */
export function SecurityOverview() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Column title="Built and tested" subtitle="Running in this version." items={implemented} done />
      <Column title="Before a public launch" subtitle="Needs hosting or an email provider." items={needsBackend} done={false} />
    </div>
  )
}

export function SecuritySection() {
  return (
    <section id="security" className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-balance font-display text-3xl font-bold sm:text-4xl">Security you can inspect</h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground sm:text-lg">
            We list what is built and tested, and what still needs hosting or an email provider, so nothing is claimed that isn't true.
          </p>
        </div>
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.4 }} className="mt-10">
          <SecurityOverview />
        </motion.div>
      </div>
    </section>
  )
}
