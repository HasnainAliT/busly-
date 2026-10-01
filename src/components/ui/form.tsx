import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const control =
  'flex w-full rounded-lg border border-white/10 bg-white/5 px-3.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground/80 focus-visible:border-primary/60 focus-visible:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'

interface WrapProps {
  label: string
  error?: string | null
  hint?: ReactNode
  className?: string
}

function Wrap({ label, error, hint, className, id, children }: WrapProps & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export const SelectField = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & WrapProps>(({ label, error, hint, className, id, children, ...props }, ref) => {
  const auto = useId()
  const fid = id ?? auto
  return (
    <Wrap label={label} error={error} hint={hint} className={className} id={fid}>
      <div className="relative">
        <select ref={ref} id={fid} aria-invalid={!!error || undefined} aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined} className={cn(control, 'h-11 appearance-none pr-9')} {...props}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>
    </Wrap>
  )
})
SelectField.displayName = 'SelectField'

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & WrapProps>(({ label, error, hint, className, id, ...props }, ref) => {
  const auto = useId()
  const fid = id ?? auto
  return (
    <Wrap label={label} error={error} hint={hint} className={className} id={fid}>
      <textarea ref={ref} id={fid} aria-invalid={!!error || undefined} aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined} className={cn(control, 'min-h-24 resize-y py-2.5')} {...props} />
    </Wrap>
  )
})
TextareaField.displayName = 'TextareaField'

/** Small stat tile used on the operator and driver screens. */
export function Tile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'warning' | 'danger' | 'success' }) {
  return (
    <div className="glass min-w-0 rounded-2xl p-4">
      <p className="truncate text-[13px] text-muted-foreground">{label}</p>
      <p className={cn('mt-1.5 font-display text-2xl font-bold leading-none tabular-nums', tone === 'warning' && 'text-warning', tone === 'danger' && 'text-danger', tone === 'success' && 'text-success')}>{value}</p>
      {sub && <p className="mt-1.5 truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

export function Panel({ title, action, children, className, id }: { title?: string; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn('glass min-w-0 rounded-2xl p-4 sm:p-5', className)} aria-label={title}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-base font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}
