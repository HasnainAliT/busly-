import type { CSSProperties } from 'react'
import { markerTheme } from '@/components/map/Markers'
import type { BusStatus } from '@/types'

const order: BusStatus[] = ['active', 'delayed', 'available', 'break', 'offline']

export function MapLegend({ style }: { style?: CSSProperties }) {
  return (
    <ul className="glass absolute z-10 hidden items-center gap-3.5 rounded-xl px-3.5 py-2 text-xs text-muted-foreground md:flex" style={style} aria-label="Map legend">
      {order.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full"
            style={{ background: markerTheme[s].fill, boxShadow: s === 'offline' ? `inset 0 0 0 1px ${markerTheme[s].ring}` : undefined }}
          />
          {markerTheme[s].label}
        </li>
      ))}
    </ul>
  )
}
