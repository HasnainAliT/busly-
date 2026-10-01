import { motion, type HTMLMotionProps } from 'framer-motion'
import type { ReactNode } from 'react'

/** Fades and lifts content in as it scrolls into view. App-level MotionConfig turns it off for reduced-motion users. */
export function Reveal({ children, delay = 0, className, ...rest }: { children: ReactNode; delay?: number; className?: string } & Omit<HTMLMotionProps<'div'>, 'children'>) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }} className={className} {...rest}>
      {children}
    </motion.div>
  )
}
