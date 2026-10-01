import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, Gauge, MapPinOff, RefreshCw, RotateCcw, TriangleAlert, UserCog, WifiOff, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLiveFeed } from '@/hooks/useLiveFeed'
import { useAuth } from '@/context/AuthContext'
import { demoAccounts } from '@/hooks/useDemoLogin'
import type { Role } from '@/types'
import { useLocationAccess } from '@/context/LocationContext'
import { cn } from '@/lib/utils'

/** Prototype-only switchboard so reviewers can preview offline, error and permission states in seconds. */
export function DemoPanel() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { feed, status } = useLiveFeed()
  const loc = useLocationAccess()
  const forced = feed.getForcedState()
  const { user, login, mode } = useAuth()
  const navigate = useNavigate()
  const { data } = useLiveFeed()
  const switchTo = async (role: Role) => {
    const a = demoAccounts[role]
    await login(a.email, '', a.name)
    setOpen(false)
    navigate(a.home)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const Option = ({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium transition-colors [&_svg]:size-4',
        active ? 'bg-primary/15 text-primary' : 'text-foreground/85 hover:bg-white/8',
      )}
    >
      {icon}
      {children}
    </button>
  )

  return (
    <div ref={ref} className="relative">
      <Button variant="glass" size="icon-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Demo controls" title="Demo controls">
        <FlaskConical />
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            className="glass-strong absolute right-0 top-11 z-50 max-h-[80dvh] w-[260px] origin-top-right overflow-y-auto rounded-xl p-2"
            role="dialog"
            aria-label="Demo controls"
          >
            <p className="px-3 pb-1.5 pt-1.5 text-xs font-semibold text-muted-foreground">Preview app states</p>
            <Option active={!forced && status === 'live'} onClick={() => feed.forceState(null)} icon={<Zap />}>Live data</Option>
            <Option active={forced === 'offline'} onClick={() => feed.forceState('offline')} icon={<WifiOff />}>Offline</Option>
            <Option active={forced === 'error'} onClick={() => feed.forceState('error')} icon={<TriangleAlert />}>Service error</Option>
            <Option active={false} onClick={() => { feed.retry(); setOpen(false) }} icon={<RefreshCw />}>Reload with skeletons</Option>
            <div className="my-1.5 h-px bg-white/8" />
            <Option active={loc.state === 'denied'} onClick={() => (loc.state === 'denied' ? loc.request() : loc.disable())} icon={<MapPinOff />}>
              {loc.state === 'denied' ? 'Location disabled (tap to enable)' : 'Disable location'}
            </Option>
            {mode === 'local' && (
              <>
                <div className="my-1.5 h-px bg-white/8" />
                <p className="px-3 pb-1 pt-1 text-xs font-semibold text-muted-foreground">Switch demo role</p>
                {(Object.keys(demoAccounts) as Role[]).map((r) => (
                  <Option key={r} active={user?.role === r} onClick={() => void switchTo(r)} icon={<UserCog />}>
                    {demoAccounts[r].label}
                  </Option>
                ))}
                <div className="my-1.5 h-px bg-white/8" />
                <p className="px-3 pb-1 pt-1 text-xs font-semibold text-muted-foreground">Simulation speed</p>
                <div className="flex gap-1 px-2 pb-1" role="group" aria-label="Simulation speed">
                  {[1, 4, 14, 30].map((v) => (
                    <button
                      key={v}
                      aria-pressed={data.simSpeed === v}
                      onClick={() => void feed.dispatch({ type: 'sim/speed', simSpeed: v })}
                      className={cn('flex h-9 flex-1 items-center justify-center gap-1 rounded-lg text-xs font-semibold', data.simSpeed === v ? 'bg-primary/15 text-primary' : 'bg-white/5 hover:bg-white/10')}
                    >
                      {v === 1 && <Gauge className="size-3" />}
                      {v}x
                    </button>
                  ))}
                </div>
                <Option active={false} onClick={() => { feed.resetDemo(); setOpen(false) }} icon={<RotateCcw />}>Reset demo data</Option>
              </>
            )}
            <p className="px-3 pb-1.5 pt-2 text-[11px] leading-snug text-muted-foreground">
              {mode === 'api' ? 'Connected to the Busly server. Bus positions are simulated unless a driver shares phone GPS.' : 'Demo mode: data lives in this browser and bus positions are simulated. Run the server for a shared backend.'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
