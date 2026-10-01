import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useDragControls, useMotionValue, type PanInfo } from 'framer-motion'
import { cn } from '@/lib/utils'

export type SheetSnap = 'peek' | 'expanded'

interface Props {
  snap: SheetSnap
  onSnapChange: (snap: SheetSnap) => void
  /** Visible height in px while collapsed. */
  peek: number
  /** Share of the container the sheet may cover when expanded. */
  maxHeightRatio?: number
  children: ReactNode
  label: string
  className?: string
}

/** Draggable bottom sheet. Drag starts only from the handle area so the content can scroll freely. */
export function BottomSheet({ snap, onSnapChange, peek, maxHeightRatio = 0.8, children, label, className }: Props) {
  const controls = useDragControls()
  const y = useMotionValue(0)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [sheetH, setSheetH] = useState(0)

  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSheetH(e.contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const collapsedY = Math.max(0, sheetH - peek)
  useEffect(() => {
    if (!sheetH) return
    const ctrl = animate(y, snap === 'expanded' ? 0 : collapsedY, { type: 'spring', stiffness: 420, damping: 40, mass: 0.9 })
    return () => ctrl.stop()
  }, [snap, collapsedY, sheetH, y])

  const onDragEnd = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const current = y.get()
    const goExpanded = info.velocity.y < -380 || (Math.abs(info.velocity.y) < 380 && current < collapsedY / 2)
    const next: SheetSnap = goExpanded ? 'expanded' : 'peek'
    if (next === snap) animate(y, next === 'expanded' ? 0 : collapsedY, { type: 'spring', stiffness: 420, damping: 40 })
    onSnapChange(next)
  }

  return (
    <motion.section
      ref={sheetRef}
      aria-label={label}
      className={cn('glass-strong absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-b-none rounded-t-[22px] border-x-0 border-b-0', className)}
      style={{ y, height: `${maxHeightRatio * 100}%` }}
      drag="y"
      dragControls={controls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: collapsedY }}
      dragElastic={{ top: 0.04, bottom: 0.12 }}
      onDragEnd={onDragEnd}
    >
      <div
        className="flex shrink-0 cursor-grab touch-none flex-col items-center px-4 pb-1 pt-2.5 active:cursor-grabbing"
        onPointerDown={(e) => controls.start(e)}
        onDoubleClick={() => onSnapChange(snap === 'expanded' ? 'peek' : 'expanded')}
      >
        <button
          type="button"
          aria-label={snap === 'expanded' ? 'Collapse panel' : 'Expand panel'}
          aria-expanded={snap === 'expanded'}
          onClick={() => onSnapChange(snap === 'expanded' ? 'peek' : 'expanded')}
          className="grid h-5 w-16 place-items-center rounded-full"
        >
          <span className="block h-1 w-10 rounded-full bg-white/25" />
        </button>
      </div>
      <div className={cn('min-h-0 flex-1 px-4 pb-4', snap === 'expanded' ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden')}>{children}</div>
    </motion.section>
  )
}
