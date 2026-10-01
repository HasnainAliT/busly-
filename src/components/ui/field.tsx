import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string | null
  hint?: ReactNode
  icon?: ReactNode
  /** Rendered on the label row, right-aligned (e.g. "Forgot password?"). */
  trailing?: ReactNode
  /** Rendered inside the input, right-aligned (e.g. show/hide toggle). */
  adornment?: ReactNode
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(({ label, error, hint, icon, trailing, adornment, className, id, ...props }, ref) => {
  const auto = useId()
  const fieldId = id ?? auto
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium">
          {label}
        </label>
        {trailing}
      </div>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">{icon}</span>}
        <Input ref={ref} id={fieldId} invalid={!!error} aria-describedby={describedBy} className={cn(icon && 'pl-10', adornment && 'pr-12')} {...props} />
        {adornment && <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{adornment}</div>}
      </div>
      {error ? (
        <p id={`${fieldId}-error`} role="alert" className="mt-1.5 text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="mt-1.5 text-[13px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
})
Field.displayName = 'Field'

/** Password input with a show/hide toggle. The value is never rendered anywhere else. */
export const PasswordField = forwardRef<HTMLInputElement, Omit<FieldProps, 'type' | 'adornment'>>((props, ref) => {
  const [shown, setShown] = useState(false)
  return (
    <Field
      ref={ref}
      type={shown ? 'text' : 'password'}
      {...props}
      adornment={
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  )
})
PasswordField.displayName = 'PasswordField'
