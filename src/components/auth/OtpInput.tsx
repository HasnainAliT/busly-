import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (v: string) => void
  length?: number
  invalid?: boolean
  disabled?: boolean
}

/** Six single-digit boxes with auto-advance, backspace and paste support. Digits only. */
export function OtpInput({ value, onChange, length = 6, invalid, disabled }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const set = (i: number, d: string) => {
    const next = digits.slice()
    next[i] = d
    onChange(next.join('').slice(0, length))
  }

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[i]) set(i, '')
      else if (i > 0) {
        set(i - 1, '')
        refs.current[i - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus()
  }

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    e.preventDefault()
    onChange(pasted)
    refs.current[Math.min(pasted.length, length - 1)]?.focus()
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Verification code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={d}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(-1)
            set(i, v)
            if (v && i < length - 1) refs.current[i + 1]?.focus()
          }}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            'h-14 w-full min-w-0 rounded-lg border bg-white/5 text-center font-display text-xl font-semibold transition-colors focus-visible:border-primary/60 focus-visible:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            invalid ? 'border-danger/60' : 'border-white/10',
          )}
        />
      ))}
    </div>
  )
}
