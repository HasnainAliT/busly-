import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  hideTitle?: boolean
}

/**
 * Accessible dialog (focus trap, Esc, aria labelling from Radix) with a fade + scale transition.
 * On phones it docks to the bottom edge like a sheet; from md up it is centred.
 */
export function Modal({ open, onOpenChange, title, description, children, className, hideTitle }: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-[3px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </DialogPrimitive.Overlay>
            <div className="pointer-events-none fixed inset-0 z-[71] flex items-end justify-center p-0 md:items-center md:p-6">
              <DialogPrimitive.Content asChild forceMount>
                <motion.div
                  className={cn(
                    'glass-strong pointer-events-auto relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl outline-none md:max-h-[88dvh] md:rounded-2xl',
                    className,
                  )}
                  initial={{ opacity: 0, y: 28, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.14 } }}
                  transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                >
                  <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', hideTitle && 'sr-only')}>
                    <div className="min-w-0">
                      <DialogPrimitive.Title className="font-display text-lg font-semibold leading-tight">{title}</DialogPrimitive.Title>
                      {description ? (
                        <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
                      ) : (
                        <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
                      )}
                    </div>
                  </div>
                  <DialogPrimitive.Close
                    className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="size-[18px]" />
                  </DialogPrimitive.Close>
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4 safe-bottom">{children}</div>
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}
