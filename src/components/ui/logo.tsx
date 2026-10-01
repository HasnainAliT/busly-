import { useId } from 'react'
import { cn } from '@/lib/utils'

/** Route-line mark: a trip that starts at a stop and ends on a live destination pin. */
export function LogoMark({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn('size-9', className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1F6B54" />
          <stop offset="1" stopColor="#0E3B2E" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${id})`} />
      <path d="M14 33c0-6 4-7 8-7h4c4 0 8-1 8-7" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="14" cy="33" r="3.4" fill="#fff" />
      <circle cx="34" cy="14" r="4.4" fill="#fff" fillOpacity=".28" />
      <circle cx="34" cy="14" r="2.6" fill="#BFE8D4" />
    </svg>
  )
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {!compact && <span className="font-display text-[22px] font-medium leading-none tracking-tight">Busly</span>}
    </span>
  )
}
