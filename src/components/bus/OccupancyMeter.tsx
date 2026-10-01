import { cn } from '@/lib/utils'

export function OccupancyMeter({ value, label, compact = false }: { value: number; label?: string; compact?: boolean }) {
  const tone = value < 55 ? 'bg-success' : value < 85 ? 'bg-warning' : 'bg-danger'
  return (
    <div className="w-full">
      {!compact && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{label ?? 'Occupancy'}</span>
          <span className="font-semibold tabular-nums">{value}%</span>
        </div>
      )}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label={label ?? 'Occupancy'}
      >
        <div className={cn('h-full rounded-full transition-[width] duration-700', tone)} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
