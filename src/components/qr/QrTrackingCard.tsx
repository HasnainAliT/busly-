import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Copy, ExternalLink, QrCode, Share2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { buildTrackingUrl } from '@/utils/security'
import { copyText, shareLink } from '@/utils/share'
import type { BusInsight } from '@/utils/bus'
import { cn } from '@/lib/utils'

export function QrTrackingCard({ insight, className }: { insight: BusInsight; className?: string }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const url = buildTrackingUrl(insight.bus.id)

  const copy = async () => {
    const ok = await copyText(url)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
      toast({ title: 'Tracking link copied', description: url.replace(/^https?:\/\//, ''), tone: 'success' })
    } else {
      toast({ title: "Couldn't copy the link", description: 'Select it manually from the address bar.', tone: 'warning' })
    }
  }

  const share = async () => {
    const shared = await shareLink({ title: `Track ${insight.bus.id} on Busly`, text: `Follow ${insight.bus.id} live on Route ${insight.route.code}.`, url })
    if (!shared) copy()
  }

  return (
    <div className={cn('glass-strong relative overflow-hidden rounded-2xl p-5', className)}>
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/15 blur-3xl" aria-hidden />
      <div className="relative flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <QrCode className="size-4 text-primary" />
        Scan to track this bus
      </div>

      <div className="relative mx-auto mt-4 w-fit rounded-2xl bg-white p-3.5 shadow-[0_18px_40px_-18px_hsl(var(--primary)/.6)]">
        <QRCodeSVG value={url} size={176} level="M" bgColor="#ffffff" fgColor="#0a1020" marginSize={0} aria-label={`QR code that opens live tracking for ${insight.bus.id}`} role="img" />
        <div className="pointer-events-none absolute inset-3.5 overflow-hidden rounded-lg" aria-hidden>
          <motion.div
            className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-primary/35 to-transparent"
            initial={{ top: '-20%' }}
            animate={{ top: ['-20%', '100%'] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.6 }}
          />
        </div>
      </div>

      <div className="relative mt-4 text-center">
        <p className="font-display text-xl font-bold">{insight.bus.id}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Route: {insight.route.from} to {insight.route.to}
        </p>
        <p className="mx-auto mt-3 max-w-[16rem] truncate rounded-md bg-white/6 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground" title={url}>
          {url.replace(/^https?:\/\//, '')}
        </p>
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-2">
        <Button variant="subtle" size="sm" onClick={copy} aria-live="polite">
          {copied ? <Check className="text-success" /> : <Copy />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="subtle" size="sm" onClick={share}>
          <Share2 /> Share
        </Button>
        <Button variant="subtle" size="sm" asChild>
          <Link to={`/track/${insight.bus.id}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Open
          </Link>
        </Button>
      </div>
      <p className="relative mt-3 text-center text-xs text-muted-foreground">Anyone with this link can see this bus's live position. It never shows rider data.</p>
    </div>
  )
}
