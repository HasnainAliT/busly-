import { Modal } from '@/components/ui/modal'
import { QrTrackingCard } from '@/components/qr/QrTrackingCard'
import type { BusInsight } from '@/utils/bus'

export function QrCodeDialog({ insight, open, onOpenChange }: { insight: BusInsight | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Modal open={open && !!insight} onOpenChange={onOpenChange} title="Share live tracking" description="Riders can scan this code to follow the bus." className="max-w-sm">
      {insight && <QrTrackingCard insight={insight} className="border-0 bg-transparent p-0 shadow-none" />}
    </Modal>
  )
}
