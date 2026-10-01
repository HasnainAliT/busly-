import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, Check, ClipboardPaste, ScanLine, ShieldCheck, TriangleAlert } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/bus/StatusBadge'
import { useQrCamera } from '@/components/qr/useQrCamera'
import { useBuses } from '@/hooks/useLiveFeed'
import { useUserData } from '@/context/UserDataContext'
import { buildTrackingUrl, parseTrackingPayload } from '@/utils/security'
import { cn } from '@/lib/utils'

type Mode = 'simulate' | 'camera'
type Phase = 'ready' | 'scanning' | 'success' | 'error'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with a validated bus id. Defaults to opening the public tracking page. */
  onResult?: (busId: string) => void
}

/**
 * Modular scanner. All sources (simulated, camera, pasted link) feed the same `handlePayload`,
 * which validates before anything is opened. A native/WASM scanner only needs to call it too.
 */
export function QrScannerModal({ open, onOpenChange, onResult }: Props) {
  const navigate = useNavigate()
  const { insights } = useBuses()
  const { addRecentBus, addActivity } = useUserData()
  const [mode, setMode] = useState<Mode>('simulate')
  const [phase, setPhase] = useState<Phase>('ready')
  const [pick, setPick] = useState('BUS-104')
  const [found, setFound] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')

  const handlePayload = useCallback(
    (raw: string) => {
      const result = parseTrackingPayload(raw)
      if (!result.ok) {
        setError(result.reason)
        setPhase('error')
        return
      }
      setFound(result.busId)
      setError(null)
      setPhase('success')
    },
    [],
  )

  const camera = useQrCamera(handlePayload)

  useEffect(() => {
    if (!open) {
      camera.stop()
      const t = setTimeout(() => {
        setPhase('ready')
        setFound(null)
        setError(null)
        setPasted('')
        setMode('simulate')
      }, 200)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (phase === 'success' || phase === 'error') camera.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const runSimulation = () => {
    setPhase('scanning')
    setError(null)
    setTimeout(() => handlePayload(buildTrackingUrl(pick)), 1700)
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setPhase('ready')
    setError(null)
    if (m === 'camera') {
      setPhase('scanning')
      camera.start()
    } else camera.stop()
  }

  const foundInsight = insights.find((i) => i.bus.id === found)

  const openBus = () => {
    if (!found) return
    addRecentBus(found)
    addActivity(`Scanned QR code for ${found}`)
    onOpenChange(false)
    if (onResult) onResult(found)
    else navigate(`/track/${found}`)
  }

  const cameraProblem =
    camera.state === 'unsupported'
      ? "Camera scanning isn't supported in this browser. Use the simulated scanner or paste a link."
      : camera.state === 'denied'
        ? 'Camera access is blocked. Allow it in your browser settings, or use the simulated scanner.'
        : camera.state === 'error'
          ? "We couldn't start the camera. Use the simulated scanner instead."
          : null

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Scan a bus QR code" description="Point your camera at the code on the bus, or try the simulated scanner.">
      <div role="tablist" aria-label="Scanner source" className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-white/6 p-1">
        {([['simulate', 'Simulated scan', ScanLine], ['camera', 'Use camera', Camera]] as const).map(([m, label, Icon]) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={cn(
              'flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors',
              mode === m ? 'bg-white/12 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {/* viewfinder */}
      <div className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-2xl border border-white/10 bg-black/50">
        {mode === 'camera' ? (
          <video ref={camera.videoRef} muted playsInline className="size-full object-cover" aria-label="Camera preview" />
        ) : (
          <div className="grid size-full place-items-center">
            <div className={cn('rounded-xl bg-white p-3 transition-all duration-500', phase === 'ready' ? 'scale-[.82] opacity-35 blur-[1px]' : 'scale-90 opacity-90')}>
              <QRCodeSVG value={buildTrackingUrl(pick)} size={150} bgColor="#ffffff" fgColor="#0a1020" marginSize={0} />
            </div>
          </div>
        )}

        {/* corner brackets */}
        {[['left-3 top-3 border-l-2 border-t-2 rounded-tl-xl'], ['right-3 top-3 border-r-2 border-t-2 rounded-tr-xl'], ['left-3 bottom-3 border-b-2 border-l-2 rounded-bl-xl'], ['right-3 bottom-3 border-b-2 border-r-2 rounded-br-xl']].map(([c]) => (
          <span key={c} aria-hidden className={cn('absolute size-9 transition-colors duration-300', c, phase === 'success' ? 'border-success' : phase === 'error' ? 'border-danger' : 'border-primary')} />
        ))}

        {phase === 'scanning' && (
          <span aria-hidden className="absolute inset-x-5 top-[4%] h-0.5 animate-scan rounded-full bg-primary shadow-[0_0_18px_4px_hsl(var(--primary)/.7)]" />
        )}

        <AnimatePresence>
          {phase === 'success' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
              <motion.span
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                className="grid size-16 place-items-center rounded-full bg-success text-background"
              >
                <Check className="size-8" strokeWidth={3} />
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 min-h-[120px]" aria-live="polite">
        {mode === 'camera' && cameraProblem && phase !== 'success' && (
          <Notice tone="warning">{cameraProblem}</Notice>
        )}

        {phase === 'error' && error && (
          <Notice tone="danger">
            {error}
            <button className="ml-2 font-semibold underline underline-offset-2" onClick={() => { setPhase('ready'); setError(null) }}>Try again</button>
          </Notice>
        )}

        {phase === 'success' && foundInsight && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="glass flex items-center justify-between gap-3 rounded-xl p-3.5">
              <div className="min-w-0">
                <p className="font-display text-base font-semibold">{foundInsight.bus.id}</p>
                <p className="truncate text-[13px] text-muted-foreground">Route {foundInsight.route.code}: {foundInsight.route.from} to {foundInsight.route.to}</p>
              </div>
              <StatusBadge status={foundInsight.bus.status} />
            </div>
            <Button className="w-full" onClick={openBus}>Open live tracking</Button>
          </motion.div>
        )}

        {mode === 'simulate' && (phase === 'ready' || phase === 'scanning') && (
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1.5 block text-muted-foreground">Code on the bus</span>
              <select
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                disabled={phase === 'scanning'}
                className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {insights.map((i) => (
                  <option key={i.bus.id} value={i.bus.id} className="bg-[#0d1424]">
                    {i.bus.id} · Route {i.route.code}
                  </option>
                ))}
              </select>
            </label>
            <Button className="w-full" onClick={runSimulation} disabled={phase === 'scanning'}>
              <ScanLine /> {phase === 'scanning' ? 'Scanning...' : 'Scan this code'}
            </Button>
          </div>
        )}

        {(phase === 'ready' || phase === 'error') && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              handlePayload(pasted)
            }}
          >
            <Input value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Or paste a tracking link" maxLength={300} aria-label="Paste a tracking link" inputMode="url" autoComplete="off" />
            <Button type="submit" variant="outline" size="icon" aria-label="Check link" disabled={!pasted.trim()}>
              <ClipboardPaste />
            </Button>
          </form>
        )}
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        Busly only opens its own tracking links and checks the bus number before it navigates.
      </p>
    </Modal>
  )
}

function Notice({ tone, children }: { tone: 'warning' | 'danger'; children: React.ReactNode }) {
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-[13px] leading-snug', tone === 'danger' ? 'border-danger/30 bg-danger/10 text-danger' : 'border-warning/30 bg-warning/10 text-warning')}>
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}
