import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

/** Two-step destructive button: first click arms it, second click confirms. No browser dialogs. */
export function ConfirmButton({ label, confirmLabel = 'Confirm', onConfirm, disabled, icon }: { label: string; confirmLabel?: string; onConfirm: () => void; disabled?: boolean; icon?: ReactNode }) {
  const [armed, setArmed] = useState(false)
  return armed ? (
    <span className="inline-flex gap-1.5">
      <Button size="sm" variant="destructive" disabled={disabled} onClick={() => { setArmed(false); onConfirm() }}>
        {confirmLabel}
      </Button>
      <Button size="sm" variant="glass" onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </span>
  ) : (
    <Button size="sm" variant="glass" disabled={disabled} onClick={() => setArmed(true)}>
      {icon}
      {label}
    </Button>
  )
}

