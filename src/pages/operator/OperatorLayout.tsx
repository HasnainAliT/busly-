import { Suspense } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, Bell, Bus, LayoutDashboard, LogOut, Map as MapIcon, Route as RouteIcon, ScrollText, ShieldCheck, Users } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { ConnectionStatus } from '@/components/layout/Topbar'
import { DemoPanel } from '@/components/layout/DemoPanel'
import { PageFallback } from '@/components/layout/PageFallback'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const items = [
  { to: '/operator', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/operator/fleet', label: 'Fleet', icon: Bus },
  { to: '/operator/routes', label: 'Routes and stops', icon: RouteIcon },
  { to: '/operator/alerts', label: 'Service alerts', icon: Bell },
  { to: '/operator/trips', label: 'Trips', icon: ScrollText },
  { to: '/operator/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/operator/users', label: 'Users and roles', icon: Users, adminOnly: true },
]

/** Operations console shell for operators and administrators: sidebar from md, scrolling tab bar on phones. */
export function OperatorLayout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const nav = items.filter((i) => !i.adminOnly || user?.role === 'admin')
  const current = [...nav].reverse().find((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)))

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col border-r border-white/8 bg-background/85 backdrop-blur-xl md:flex lg:w-[256px]">
        <Link to="/" className="flex h-16 items-center justify-center px-4 lg:justify-start lg:px-5" aria-label="Busly home">
          <Logo className="[&>span:last-child]:hidden lg:[&>span:last-child]:inline" />
        </Link>
        <nav aria-label="Operations" className="flex-1 space-y-1 px-3 py-3">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              className={({ isActive }) =>
                cn('relative flex h-11 items-center justify-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors lg:justify-start', isActive ? 'border border-primary/30 bg-primary/12 text-foreground' : 'border border-transparent text-muted-foreground hover:bg-white/6 hover:text-foreground')
              }
            >
              <Icon className="size-[19px]" />
              <span className="hidden lg:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 border-t border-white/8 p-3">
          <Button asChild variant="glass" size="sm" className="w-full justify-center lg:justify-start">
            <Link to="/app" title="Passenger view">
              <MapIcon /> <span className="hidden lg:inline">Passenger view</span>
            </Link>
          </Button>
          <div className="flex items-center gap-3 rounded-xl p-2 lg:bg-white/4">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-secondary font-display text-sm font-bold text-primary-foreground" aria-hidden>
              {user?.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="hidden min-w-0 flex-1 lg:block">
              <p className="truncate text-sm font-semibold">{user?.name}</p>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <ShieldCheck className="size-3" /> {user?.role === 'admin' ? 'Administrator' : 'Operator'}
              </p>
            </div>
            <button onClick={logout} aria-label="Sign out" title="Sign out" className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground lg:block">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="md:pl-[72px] lg:pl-[256px]">
        <header className="sticky top-0 z-30 border-b border-white/8 bg-background/85 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between gap-3 px-4 md:h-16 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Link to="/" className="md:hidden" aria-label="Busly home">
                <Logo />
              </Link>
              <p className="hidden font-display text-lg font-semibold md:block">{current?.label ?? 'Operations'}</p>
            </div>
            <div className="flex items-center gap-2">
              <ConnectionStatus />
              <DemoPanel />
              <Button variant="glass" size="icon-sm" className="md:hidden" onClick={logout} aria-label="Sign out">
                <LogOut />
              </Button>
            </div>
          </div>
          <nav aria-label="Operations" className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold', isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground')}>
                <Icon className="size-4" /> {label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main id="main" className="mx-auto min-h-[calc(100dvh-4rem)] w-full max-w-7xl px-4 py-5 pb-10 md:px-8 md:py-8">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
