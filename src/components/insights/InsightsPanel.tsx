import { AlertTriangle, ChevronDown, Lightbulb, Scale, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Panel } from '@/components/ui/form'
import { cn } from '@/lib/utils'
import type { Insight, InsightKind, InsightSeverity } from '@/domain/insights'

const kindMeta: Record<InsightKind, { label: string; icon: typeof AlertTriangle }> = {
  anomaly: { label: 'Unusual today', icon: AlertTriangle },
  comparison: { label: 'Compared with usual', icon: Scale },
  recommendation: { label: 'Suggestion', icon: Lightbulb },
}
const tone: Record<InsightSeverity, 'danger' | 'warning' | 'info'> = { act: 'danger', watch: 'warning', info: 'info' }
const severityLabel: Record<InsightSeverity, string> = { act: 'Act soon', watch: 'Keep an eye', info: 'For info' }

/** Explainable insights: each card opens to show the numbers it came from. */
export function InsightsPanel({ insights, className }: { insights: Insight[]; className?: string }) {
  return (
    <Panel title="Insights and anomalies" className={className} action={<span className="text-xs text-muted-foreground">Statistics on your own trip history, not a trained model</span>}>
      {insights.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl bg-success/10 p-4 text-sm">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <p>
            <b>Nothing unusual right now.</b> Delays, trip times and load are all within each route&apos;s normal range for the last few days.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {insights.map((i) => {
            const { icon: Icon, label } = kindMeta[i.kind]
            return (
              <li key={i.id}>
                <details className="group rounded-xl border border-white/10 bg-white/4 open:bg-white/6">
                  <summary className="flex cursor-pointer list-none items-start gap-3 rounded-xl p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    <Icon className="mt-0.5 size-4.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{i.title}</span>
                        <Badge tone={tone[i.severity]}>{severityLabel[i.severity]}</Badge>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{label} · tap to see why</span>
                    </span>
                    <ChevronDown className={cn('mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180')} aria-hidden />
                  </summary>
                  <div className="space-y-3 border-t border-white/8 px-3.5 pb-3.5 pt-3 text-sm">
                    <p>{i.why}</p>
                    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {i.evidence.map((e) => (
                        <div key={e.label} className="rounded-lg bg-white/5 px-3 py-2">
                          <dt className="text-xs text-muted-foreground">{e.label}</dt>
                          <dd className="font-display font-semibold">{e.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
