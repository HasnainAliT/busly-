import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'success' | 'info' | 'warning' | 'danger'

interface ToastItem {
  id: number
  title: string
  description?: string
  tone: Tone
}

interface ToastApi {
  toast: (t: { title: string; description?: string; tone?: Tone }) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const toneStyle: Record<Tone, { icon: typeof Info; color: string }> = {
  success: { icon: CheckCircle2, color: 'text-success' },
  info: { icon: Info, color: 'text-primary' },
  warning: { icon: AlertTriangle, color: 'text-warning' },
  danger: { icon: XCircle, color: 'text-danger' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), [])

  const toast = useCallback<ToastApi['toast']>(
    ({ title, description, tone = 'info' }) => {
      const id = ++counter.current
      setItems((l) => [...l.slice(-2), { id, title, description, tone }])
      setTimeout(() => dismiss(id), 4200)
    },
    [dismiss],
  )

  const api = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const { icon: Icon, color } = toneStyle[t.tone]
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="glass-strong pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl p-3.5"
                role="status"
              >
                <Icon className={cn('mt-0.5 size-[18px] shrink-0', color)} strokeWidth={2} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{t.description}</p>}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  className="-m-1 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Dismiss"
                >
                  <X className="size-4" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx.toast
}
