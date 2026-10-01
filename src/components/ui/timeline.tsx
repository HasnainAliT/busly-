import { Activity } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { StateCard } from '@/components/ui/states'
import { useActivityTimeline } from '@/hooks/useActivityTimeline'

function ago(at: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - at) / 60000))
  if (m < 1) return 'Just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr ago`
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** Vertical activity timeline. `all` shows everyone's activity (operators and admins only; the server enforces it). */
export function ActivityTimeline({ all = false, limit = 10 }: { all?: boolean; limit?: number }) {
  const { items, loading, error } = useActivityTimeline({ all, limit })
  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading activity">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    )
  }
  if (error && items.length === 0) return <StateCard icon={<Activity />} title="Activity is unavailable" description="We couldn't load your activity. It will retry on its own." />
  if (items.length === 0) return <StateCard icon={<Activity />} title="No activity yet" description="Searches, saved items and sign-ins will show up here." />
  return (
    <ol className="relative space-y-4 border-l border-white/12 pl-5" aria-label="Activity timeline">
      {items.map((it) => (
        <li key={it.id} className="relative">
          <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary" aria-hidden />
          <p className="text-sm font-medium leading-snug">{it.text}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {it.by ? `${it.by} · ` : ''}
            <time dateTime={new Date(it.at).toISOString()}>{ago(it.at)}</time>
          </p>
        </li>
      ))}
    </ol>
  )
}
