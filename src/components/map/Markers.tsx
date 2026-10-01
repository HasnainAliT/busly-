import { memo } from 'react'
import { AlertTriangle, Bus, Clock, Flag, MapPinOff, WifiOff } from 'lucide-react'
import type { BusInsight } from '@/utils/bus'
import type { BusStatus } from '@/types'

/** Colours per marker state. Kept here so the legend and markers can never drift apart. */
// eslint-disable-next-line react-refresh/only-export-components
export const markerTheme: Record<BusStatus, { fill: string; icon: string; ring: string; label: string }> = {
  active: { fill: 'hsl(156 62% 54%)', icon: 'hsl(168 45% 8%)', ring: 'hsl(156 62% 54%)', label: 'On route' },
  delayed: { fill: 'hsl(38 95% 58%)', icon: 'hsl(168 45% 8%)', ring: 'hsl(38 95% 58%)', label: 'Delayed' },
  available: { fill: 'hsl(192 62% 56%)', icon: 'hsl(168 45% 8%)', ring: 'hsl(192 62% 56%)', label: 'Available' },
  break: { fill: 'hsl(166 18% 30%)', icon: 'hsl(210 30% 88%)', ring: 'hsl(166 18% 52%)', label: 'On break' },
  offline: { fill: 'hsl(166 16% 16%)', icon: 'hsl(166 12% 52%)', ring: 'hsl(166 12% 36%)', label: 'Offline' },
}

const pulseStyle = { transformBox: 'fill-box', transformOrigin: 'center' } as const

interface BusMarkerProps {
  insight: BusInsight
  scale: number
  selected: boolean
  hovered: boolean
  dimmed: boolean
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  moveMs: number
}

export const BusMarker = memo(function BusMarker({ insight, scale, selected, hovered, dimmed, onSelect, onHover, moveMs }: BusMarkerProps) {
  const { bus, position } = insight
  const theme = markerTheme[bus.status]
  const showLabel = selected || hovered
  const lost = insight.unavailable
  const live = (bus.status === 'active' || bus.status === 'delayed') && !lost

  return (
    <g
      style={{ transform: `translate(${position.x}px, ${position.y}px)`, transition: `transform ${moveMs}ms linear`, cursor: 'pointer' }}
      opacity={dimmed ? 0.55 : 1}
      role="button"
      tabIndex={0}
      aria-label={`${bus.id}, ${lost ? 'Location temporarily unavailable' : theme.label}, ${insight.route.name}. Press Enter to view details.`}
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(bus.id)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(bus.id)
        }
      }}
      onPointerEnter={() => onHover(bus.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(bus.id)}
      onBlur={() => onHover(null)}
      className="outline-none [&:focus-visible_.focus-ring]:opacity-100"
    >
      <g transform={`scale(${1 / scale})`}>
        {/* 44px hit area */}
        <circle r={22} fill="transparent" />
        <circle className="focus-ring" r={25} fill="none" stroke="white" strokeWidth={2} strokeDasharray="4 4" opacity={0} />
        {live && bus.status === 'active' && (
          <circle r={16} fill={theme.ring} opacity={0.5} className="animate-pulse-ring" style={pulseStyle} />
        )}
        {selected && <circle r={24} fill="none" stroke="white" strokeOpacity={0.9} strokeWidth={2} />}
        <circle
          r={16}
          fill={theme.fill}
          stroke={bus.status === 'offline' || lost ? theme.ring : 'rgba(255,255,255,.85)'}
          strokeWidth={bus.status === 'offline' || lost ? 1.5 : 2}
          strokeDasharray={bus.status === 'offline' || lost ? '3 3' : undefined}
          style={{ filter: live ? `drop-shadow(0 4px 10px ${theme.fill.replace(')', ' / .55)')})` : 'drop-shadow(0 3px 6px rgba(0,0,0,.5))' }}
        />
        <Bus x={-8} y={-8} width={16} height={16} strokeWidth={2.4} color={theme.icon} aria-hidden />
        {bus.status === 'delayed' && (
          <g transform="translate(11 -11)">
            <circle r={7.5} fill="hsl(168 45% 8%)" stroke={theme.fill} strokeWidth={1.5} />
            <AlertTriangle x={-4.5} y={-4.5} width={9} height={9} strokeWidth={2.6} color={theme.fill} />
          </g>
        )}
        {lost && bus.status !== 'offline' && (
          <g transform="translate(11 -11)">
            <circle r={7.5} fill="hsl(168 45% 8%)" stroke="hsl(38 95% 58%)" strokeWidth={1.5} />
            <MapPinOff x={-4.5} y={-4.5} width={9} height={9} strokeWidth={2.6} color="hsl(38 95% 58%)" />
          </g>
        )}
        {bus.status === 'offline' && (
          <g transform="translate(11 -11)">
            <circle r={7.5} fill="hsl(168 45% 8%)" stroke={theme.ring} strokeWidth={1.2} />
            <WifiOff x={-4.5} y={-4.5} width={9} height={9} strokeWidth={2.6} color="hsl(166 12% 66%)" />
          </g>
        )}
        {showLabel && (
          <g transform="translate(0 -34)" style={{ pointerEvents: 'none' }}>
            <rect x={-34} y={-12} width={68} height={24} rx={7} fill="hsl(168 40% 8% / .92)" stroke="rgba(255,255,255,.18)" />
            <text textAnchor="middle" dy="4" fontSize={11.5} fontWeight={700} fill="white" fontFamily="Plus Jakarta Sans, sans-serif">
              {bus.id}
            </text>
          </g>
        )}
      </g>
    </g>
  )
})

export const StopMarker = memo(function StopMarker({
  x,
  y,
  name,
  scale,
  showLabel,
  passed,
  highlight,
  hue,
}: {
  x: number
  y: number
  name: string
  scale: number
  showLabel: boolean
  passed: boolean
  highlight: boolean
  hue: number
}) {
  const color = highlight ? `hsl(${hue} 90% 66%)` : 'hsl(166 15% 62%)'
  return (
    <g transform={`translate(${x} ${y}) scale(${1 / scale})`} style={{ pointerEvents: 'none' }}>
      <circle r={highlight ? 6.5 : 4.5} fill="hsl(168 45% 7%)" stroke={color} strokeWidth={highlight ? 2.4 : 1.8} opacity={passed ? 0.5 : 1} />
      {showLabel && (
        <text
          x={11}
          y={4}
          fontSize={11.5}
          fontWeight={600}
          fill={highlight ? 'white' : 'hsl(160 20% 80%)'}
          fontFamily="Plus Jakarta Sans, sans-serif"
          style={{ paintOrder: 'stroke', stroke: 'hsl(168 45% 8% / .9)', strokeWidth: 3.5, strokeLinejoin: 'round' }}
        >
          {name}
        </text>
      )}
    </g>
  )
})

export function UserMarker({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${1 / scale})`} style={{ pointerEvents: 'none' }} aria-label="Your location" role="img">
      <circle r={30} fill="hsl(156 62% 54% / .1)" stroke="hsl(156 62% 54% / .35)" strokeWidth={1} />
      <circle r={9} fill="hsl(156 62% 54%)" className="animate-pulse-ring" style={pulseStyle} opacity={0.5} />
      <circle r={7.5} fill="hsl(156 65% 58%)" stroke="white" strokeWidth={2.5} />
    </g>
  )
}

export function DestinationMarker({ x, y, scale, name }: { x: number; y: number; scale: number; name: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${1 / scale})`} style={{ pointerEvents: 'none' }} role="img" aria-label={`Destination: ${name}`}>
      <g transform="translate(0 -26)">
        <path d="M0 26 L-7 14 A15 15 0 1 1 7 14 Z" fill="hsl(32 85% 58%)" stroke="white" strokeWidth={2} strokeLinejoin="round" />
        <Flag x={-7} y={-7} width={14} height={14} strokeWidth={2.4} color="white" />
      </g>
    </g>
  )
}

export function EtaChip({ x, y, scale, minutes, name }: { x: number; y: number; scale: number; minutes: number; name: string }) {
  const text = `${name} · ${minutes} min`
  const w = Math.min(190, 44 + text.length * 6.1)
  return (
    <g transform={`translate(${x} ${y}) scale(${1 / scale})`} style={{ pointerEvents: 'none' }}>
      <g transform="translate(0 -34)">
        <rect x={-w / 2} y={-13} width={w} height={26} rx={9} fill="hsl(168 40% 8% / .94)" stroke="hsl(156 62% 54% / .6)" />
        <Clock x={-w / 2 + 8} y={-6} width={12} height={12} strokeWidth={2.4} color="hsl(156 70% 68%)" />
        <text x={-w / 2 + 25} dy="4" fontSize={11.5} fontWeight={700} fill="white" fontFamily="Plus Jakarta Sans, sans-serif">
          {text}
        </text>
      </g>
    </g>
  )
}
