import { useId } from 'react'
import { cn } from '@/lib/utils'

/* Small SVG charts drawn from one scale each. Colours come from theme tokens so they read in both themes. */

const niceMax = (v: number) => {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}

interface ColumnProps {
  data: { label: string; value: number; hot?: boolean }[]
  unit: string
  ariaLabel: string
  height?: number
  labelEvery?: number
  className?: string
}

export function ColumnChart({ data, unit, ariaLabel, height = 170, labelEvery = 1, className }: ColumnProps) {
  const W = 560
  const padL = 34
  const padB = 24
  const padT = 10
  const max = niceMax(Math.max(...data.map((d) => d.value), 1))
  const plotH = height - padB - padT
  const slot = (W - padL) / data.length
  const bar = Math.max(4, slot * 0.64)
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t * 10) / 10)
  return (
    <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={ariaLabel} className={cn('w-full', className)}>
      {ticks.map((t) => {
        const y = padT + plotH - (t / max) * plotH
        return (
          <g key={t}>
            <line x1={padL} x2={W} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.1} />
            <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize={10} fill="currentColor" fillOpacity={0.6}>
              {t}
            </text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const h = (d.value / max) * plotH
        const x = padL + i * slot + (slot - bar) / 2
        return (
          <g key={d.label}>
            <title>{`${d.label}: ${d.value} ${unit}`}</title>
            <rect x={x} y={padT + plotH - h} width={bar} height={Math.max(h, d.value > 0 ? 1.5 : 0)} rx={2.5} className={d.hot ? 'fill-warning' : 'fill-primary'} fillOpacity={d.hot ? 0.95 : 0.8} />
            {i % labelEvery === 0 && (
              <text x={x + bar / 2} y={height - 7} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.65}>
                {d.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function LineChart({ data, unit, ariaLabel, height = 150, className }: { data: { label: string; value: number }[]; unit: string; ariaLabel: string; height?: number; className?: string }) {
  const id = useId()
  const W = 560
  const padL = 34
  const padB = 24
  const padT = 14
  const padR = 14
  const max = niceMax(Math.max(...data.map((d) => d.value), 1))
  const plotH = height - padB - padT
  const stepX = (W - padL - padR) / Math.max(data.length - 1, 1)
  const pts = data.map((d, i) => ({ x: padL + i * stepX, y: padT + plotH - (d.value / max) * plotH, d }))
  const line = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L ${pts[pts.length - 1].x} ${padT + plotH} L ${pts[0].x} ${padT + plotH} Z`
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t * 10) / 10)
  const last = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={ariaLabel} className={cn('w-full', className)}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
          <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => {
        const y = padT + plotH - (t / max) * plotH
        return (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.1} />
            <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize={10} fill="currentColor" fillOpacity={0.6}>
              {t}
            </text>
          </g>
        )
      })}
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p) => (
        <g key={p.d.label}>
          <title>{`${p.d.label}: ${p.d.value} ${unit}`}</title>
          <circle cx={p.x} cy={p.y} r={3} fill="hsl(var(--primary))" />
          <text x={p.x} y={height - 7} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.65}>
            {p.d.label}
          </text>
        </g>
      ))}
      <circle cx={last.x} cy={last.y} r={5.5} fill="none" stroke="hsl(var(--primary))" strokeOpacity={0.4} />
      <text x={last.x} y={Math.max(last.y - 10, 10)} textAnchor="end" fontSize={11} fontWeight={700} fill="currentColor">
        {last.d.value} {unit}
      </text>
    </svg>
  )
}

export function BarList({ rows, unit, max, hueOf }: { rows: { key: string; label: string; value: number; sub?: string; hue?: number }[]; unit: string; max?: number; hueOf?: (r: { key: string }) => number | undefined }) {
  const top = max ?? Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const hue = r.hue ?? hueOf?.(r)
        return (
          <li key={r.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="shrink-0 font-semibold tabular-nums">
                {r.value}
                <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/8" role="meter" aria-valuenow={r.value} aria-valuemin={0} aria-valuemax={top} aria-label={`${r.label}: ${r.value} ${unit}`}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.value / top) * 100)}%`, background: hue != null ? `hsl(${hue} 58% 42%)` : 'hsl(var(--primary))' }} />
            </div>
            {r.sub && <p className="mt-1 text-xs text-muted-foreground">{r.sub}</p>}
          </li>
        )
      })}
    </ul>
  )
}
