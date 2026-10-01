import { useId } from 'react'
import { cn } from '@/lib/utils'
import { markerTheme } from '@/components/map/Markers'
import type { BusStatus } from '@/types'

/** Minimal area sparkline. `label` is announced to screen readers since the line itself is decorative. */
export function Sparkline({ values, label, className, hue = 160 }: { values: number[]; label: string; className?: string; hue?: number }) {
  const id = useId()
  if (values.length < 2) return <div className={cn('h-10', className)} aria-hidden />
  const w = 120
  const h = 40
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 4 - ((v - min) / span) * (h - 10)] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L ${w} ${h} L 0 ${h} Z`
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn('h-10 w-full overflow-visible', className)} role="img" aria-label={label} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 55% 40%)`} stopOpacity=".35" />
          <stop offset="1" stopColor={`hsl(${hue} 55% 40%)`} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={`hsl(${hue} 55% 34%)`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="2.6" fill={`hsl(${hue} 55% 34%)`} />
    </svg>
  )
}

const statusOrder: BusStatus[] = ['active', 'delayed', 'available', 'break', 'offline']

/** Single stacked bar showing fleet status mix, with a legend carrying the numbers. */
export function StatusBar({ counts }: { counts: Record<BusStatus, number> }) {
  const total = statusOrder.reduce((a, s) => a + counts[s], 0) || 1
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-white/8" role="img" aria-label={statusOrder.map((s) => `${counts[s]} ${s}`).join(', ')}>
        {statusOrder.map((s) =>
          counts[s] ? <div key={s} className="h-full transition-[width] duration-700 first:rounded-l-full last:rounded-r-full" style={{ width: `${(counts[s] / total) * 100}%`, background: markerTheme[s].fill, opacity: s === 'offline' ? 0.55 : 1, marginRight: 2 }} /> : null,
        )}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {statusOrder.map((s) => (
          <li key={s} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2.5 rounded-full" style={{ background: markerTheme[s].fill, opacity: s === 'offline' ? 0.55 : 1 }} />
              {markerTheme[s].label}
            </span>
            <span className="font-semibold tabular-nums">{counts[s]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LoadBars({ rows }: { rows: { label: string; value: number; hue: number }[] }) {
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-semibold tabular-nums">{r.value}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/8" role="meter" aria-valuenow={r.value} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.label} average occupancy`}>
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${r.value}%`, background: `hsl(${r.hue} 58% 42%)` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
