import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { navItems } from '@/components/layout/navItems'
import { useNotifications } from '@/context/NotificationsContext'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

/** Full sidebar from lg, icon rail on tablets (md). Hidden on phones where the bottom bar takes over. */
export function Sidebar() {
  const { unreadCount } = useNotifications()
  const { user, logout } = useAuth()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col border-r border-white/8 bg-background/85 backdrop-blur-xl md:flex lg:w-[256px]">
      <Link to="/" className="flex h-16 items-center justify-center px-4 lg:justify-start lg:px-5" aria-label="Busly home">
        <Logo className="[&>span:last-child]:hidden lg:[&>span:last-child]:inline" />
      </Link>

      <nav aria-label="Main" className="flex-1 space-y-1 px-3 py-3">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            className={({ isActive }) =>
              cn(
                'group relative flex h-11 items-center justify-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors lg:justify-start',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:bg-white/6 hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/18 to-primary/4"
                    transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                  />
                )}
                {isActive && <span className="absolute -left-3 h-5 w-1 rounded-r-full bg-primary" aria-hidden />}
                <span className="relative">
                  <Icon className={cn('size-[19px]', isActive && 'text-primary')} strokeWidth={2} />
                  {label === 'Notifications' && unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 size-2 rounded-full bg-danger ring-2 ring-background lg:hidden" aria-hidden />
                  )}
                </span>
                <span className="relative hidden lg:inline">{label}</span>
                {label === 'Notifications' && unreadCount > 0 && (
                  <span className="relative ml-auto hidden min-w-5 rounded-md bg-danger/90 px-1.5 text-center text-[11px] font-bold leading-5 text-white lg:inline-block">
                    {unreadCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/8 p-3">
        <div className="flex items-center gap-3 rounded-xl p-2 lg:bg-white/4">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-secondary font-display text-sm font-bold text-primary-foreground" aria-hidden>
            {user?.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="hidden min-w-0 flex-1 lg:block">
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <button onClick={logout} aria-label="Sign out" title="Sign out" className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground lg:block">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
