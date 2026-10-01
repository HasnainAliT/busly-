import { Link, useLocation } from 'react-router-dom'
import { Bell, QrCode, RefreshCw } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { LiveDot } from '@/components/ui/live-dot'
import { navItems } from '@/components/layout/navItems'
import { DemoPanel } from '@/components/layout/DemoPanel'
import { useLiveFeed } from '@/hooks/useLiveFeed'
import { useNotifications } from '@/context/NotificationsContext'
import { useShell } from '@/context/ShellContext'
import { cn } from '@/lib/utils'

export function ConnectionStatus({ className }: { className?: string }) {
  const { status, feed } = useLiveFeed()
  const map = {
    live: { label: 'Live', tone: 'success' as const, cls: 'border-success/25 bg-success/10 text-success' },
    connecting: { label: 'Connecting', tone: 'warning' as const, cls: 'border-warning/25 bg-warning/10 text-warning' },
    offline: { label: 'Offline', tone: 'warning' as const, cls: 'border-warning/25 bg-warning/10 text-warning' },
    error: { label: 'Connection issue', tone: 'danger' as const, cls: 'border-danger/25 bg-danger/10 text-danger' },
  }[status]

  const body = (
    <>
      <LiveDot tone={map.tone} />
      {map.label}
      {status === 'error' && <RefreshCw className="size-3" />}
    </>
  )
  const classes = cn('inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold', map.cls, className)

  return status === 'error' ? (
    <button className={classes} onClick={() => feed.retry()} aria-label="Connection issue. Retry">
      {body}
    </button>
  ) : (
    <span className={classes} role="status">
      {body}
    </span>
  )
}

export function Topbar() {
  const { pathname } = useLocation()
  const { unreadCount } = useNotifications()
  const { openScanner } = useShell()
  const current = [...navItems].reverse().find((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)))

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-white/8 bg-background/85 px-4 backdrop-blur-xl md:h-16 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link to="/" className="md:hidden" aria-label="Busly home">
          <Logo />
        </Link>
        <p className="hidden font-display text-lg font-semibold md:block" aria-hidden>{current?.label ?? 'Busly'}</p>
      </div>
      <div className="flex items-center gap-2">
        <ConnectionStatus />
        <DemoPanel />
        <Button variant="glass" size="sm" onClick={openScanner} className="hidden sm:inline-flex">
          <QrCode /> Scan QR
        </Button>
        <Button variant="glass" size="icon-sm" onClick={openScanner} className="sm:hidden" aria-label="Scan a bus QR code">
          <QrCode />
        </Button>
        <Button variant="glass" size="icon-sm" asChild className="relative">
          <Link to="/app/notifications" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}>
            <Bell />
            {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-background">{unreadCount}</span>}
          </Link>
        </Button>
      </div>
    </header>
  )
}
