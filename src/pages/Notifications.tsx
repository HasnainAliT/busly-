import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Bell, BellOff, BusFront, CheckCheck, Megaphone, Navigation, Radio, ShieldAlert, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StateCard } from '@/components/ui/states'
import { useNotifications } from '@/context/NotificationsContext'
import { useNow } from '@/hooks/useLiveFeed'
import { formatAgo } from '@/utils/bus'
import { cn } from '@/lib/utils'
import type { NotificationKind } from '@/types'

const kindMeta: Record<NotificationKind, { icon: typeof Bell; cls: string; label: string }> = {
  approach: { icon: Navigation, cls: 'bg-primary/15 text-primary', label: 'Arriving' },
  delay: { icon: AlertTriangle, cls: 'bg-warning/15 text-warning', label: 'Delay' },
  active: { icon: Radio, cls: 'bg-success/15 text-success', label: 'Active' },
  update: { icon: BusFront, cls: 'bg-white/10 text-foreground', label: 'Update' },
  security: { icon: ShieldAlert, cls: 'bg-danger/15 text-danger', label: 'Security' },
  alert: { icon: Megaphone, cls: 'bg-primary/15 text-primary', label: 'Service alert' },
}

export default function NotificationsPage() {
  const { notifications, unreadCount, markRead, markAllRead, dismiss, clearAll } = useNotifications()
  const now = useNow(15000)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const list = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Notifications</h1>
          <p className="mt-1.5 text-muted-foreground">{unreadCount ? `${unreadCount} unread` : 'You\'re all caught up'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="glass" size="sm" onClick={markAllRead} disabled={!unreadCount}>
            <CheckCheck /> Mark all read
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={!notifications.length}>
            <Trash2 /> Clear
          </Button>
        </div>
      </div>

      <div role="tablist" aria-label="Filter notifications" className="glass mb-5 inline-grid grid-cols-2 gap-1 rounded-xl p-1">
        {(['all', 'unread'] as const).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={cn('h-9 rounded-lg px-5 text-sm font-semibold capitalize transition-colors', filter === f ? 'bg-white/12' : 'text-muted-foreground hover:text-foreground')}>
            {f}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <StateCard
          className="glass rounded-2xl"
          icon={<BellOff />}
          title={filter === 'unread' ? 'Nothing unread' : 'No notifications yet'}
          description="Save a bus to get a heads-up when it's approaching your stop or running late."
          action={<Button asChild variant="outline" size="sm"><Link to="/app/buses">Find a bus to follow</Link></Button>}
        />
      ) : (
        <ul className="space-y-2.5" aria-live="polite">
          <AnimatePresence initial={false}>
            {list.map((n) => {
              const { icon: Icon, cls, label } = kindMeta[n.kind]
              return (
                <motion.li
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className={cn('glass group relative flex items-start gap-3.5 rounded-xl p-4 transition-colors', !n.read && 'border-primary/30 bg-primary/6')}
                >
                  <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', cls)}>
                    <Icon className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold leading-snug">{n.title}</p>
                      {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                    </div>
                    <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{n.body}</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                      <span>{label}</span>
                      <span aria-hidden>·</span>
                      <time>{formatAgo(n.at, now)}</time>
                      {n.busId && (
                        <Link to={`/app/map?bus=${n.busId}`} onClick={() => markRead(n.id)} className="font-semibold text-primary hover:underline">
                          Track {n.busId}
                        </Link>
                      )}
                      {!n.read && (
                        <button onClick={() => markRead(n.id)} className="font-semibold text-foreground/80 hover:text-foreground hover:underline">
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                  <button onClick={() => dismiss(n.id)} aria-label={`Dismiss: ${n.title}`} className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground opacity-60 transition hover:bg-white/10 hover:text-foreground hover:opacity-100 focus-visible:opacity-100">
                    <X className="size-4" />
                  </button>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  )
}
