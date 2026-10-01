import { AlertTriangle, CircleCheck, CirclePause, Radio, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { statusMeta } from '@/utils/bus'
import type { BusStatus } from '@/types'

const icons = { active: Radio, delayed: AlertTriangle, available: CircleCheck, break: CirclePause, offline: WifiOff } as const

export function StatusBadge({ status, delayMin }: { status: BusStatus; delayMin?: number }) {
  const meta = statusMeta[status]
  const Icon = icons[status]
  const tone = meta.tone
  return (
    <Badge tone={tone}>
      <Icon className="size-3" strokeWidth={2.4} aria-hidden />
      {meta.label}
      {status === 'delayed' && delayMin ? ` +${delayMin} min` : ''}
    </Badge>
  )
}
