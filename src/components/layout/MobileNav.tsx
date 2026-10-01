import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { navItems } from '@/components/layout/navItems'
import { cn } from '@/lib/utils'

/** Five-slot bottom bar for phones. Targets are at least 48px tall and respect the iOS home indicator. */
export function MobileNav() {
  const items = navItems.filter((i) => i.mobile)
  return (
    <nav
      aria-label="Main"
      className="glass-strong fixed inset-x-0 bottom-0 z-40 rounded-none border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('relative flex h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span layoutId="mobile-active" className="absolute inset-x-3 top-0 h-0.5 rounded-b-full bg-primary shadow-[0_2px_12px_hsl(var(--primary))]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                  )}
                  <Icon className="size-[22px]" strokeWidth={isActive ? 2.4 : 2} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
