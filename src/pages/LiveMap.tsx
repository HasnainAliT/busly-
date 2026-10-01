import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { MapView } from '@/components/map/MapView'
import { BottomSheet, type SheetSnap } from '@/components/map/BottomSheet'
import { BusFilterBar } from '@/components/bus/BusFilterBar'
import { BusResults } from '@/components/bus/BusResults'
import { BusDetailPanel } from '@/components/bus/BusDetailPanel'
import { QrCodeDialog } from '@/components/qr/QrCodeDialog'
import { Button } from '@/components/ui/button'
import { LiveDot } from '@/components/ui/live-dot'
import { useBuses } from '@/hooks/useLiveFeed'
import { useBusFilters } from '@/hooks/useBusFilters'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useLocationAccess } from '@/context/LocationContext'
import { useUserData } from '@/context/UserDataContext'

const PEEK_LIST = 200
const PEEK_DETAIL = 284

export default function LiveMapPage() {
  const { insights, status, feed } = useBuses()
  const loc = useLocationAccess()
  const { favorites, addRecentBus, addActivity } = useUserData()
  const [params, setParams] = useSearchParams()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const isLg = useMediaQuery('(min-width: 1024px)')

  const [selectedId, setSelectedId] = useState<string | null>(() => params.get('bus'))
  const [snap, setSnap] = useState<SheetSnap>('peek')
  const [qrOpen, setQrOpen] = useState(false)

  const { filters, setFilters, results, hasActiveFilters, reset } = useBusFilters(insights, favorites.bus, loc.state === 'granted')

  const selected = useMemo(() => insights.find((i) => i.bus.id === selectedId) ?? null, [insights, selectedId])

  // Allow deep links like /app/map?bus=BUS-104 (used by "Track live" buttons).
  useEffect(() => {
    const id = params.get('bus')
    if (id && id !== selectedId && insights.some((i) => i.bus.id === id)) setSelectedId(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id)
      setSnap('peek')
      setParams(id ? { bus: id } : {}, { replace: true })
      if (id) {
        addRecentBus(id)
        addActivity(`Tracking ${id} on the live map`)
      }
    },
    [setParams, addRecentBus, addActivity],
  )

  const mapBuses = useMemo(() => {
    if (status === 'connecting' || status === 'error') return []
    const list = results.map((r) => r.insight)
    if (selected && !list.some((i) => i.bus.id === selected.bus.id)) list.push(selected)
    return list
  }, [results, selected, status])

  const panelW = isLg ? 360 : 320
  const inset = useMemo(
    () => (isDesktop ? { left: panelW + 32, top: 0, right: 0, bottom: 0 } : { top: 118, left: 0, right: 0, bottom: selected ? PEEK_DETAIL : PEEK_LIST }),
    [isDesktop, panelW, selected],
  )

  const resultsView = (
    <BusResults
      status={status}
      results={results}
      selectedId={selectedId}
      onSelect={select}
      query={filters.query}
      hasActiveFilters={hasActiveFilters}
      onReset={reset}
      onRetry={() => feed.retry()}
      locationState={loc.state}
      onEnableLocation={loc.request}
    />
  )

  return (
    <div className="relative h-full overflow-hidden">
      <MapView
        className="absolute inset-0"
        buses={mapBuses}
        selectedBusId={selectedId}
        onSelectBus={select}
        userPosition={loc.position}
        focusInset={inset}
      />

      {isDesktop ? (
        <aside
          className="glass-strong absolute bottom-4 left-4 top-4 z-20 flex flex-col overflow-hidden rounded-2xl"
          style={{ width: panelW }}
          aria-label="Bus tracking panel"
        >
          <AnimatePresence mode="wait" initial={false}>
            {selected ? (
              <motion.div
                key="detail"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.2 }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="shrink-0 px-4 pt-4">
                  <Button variant="ghost" size="sm" className="-ml-2" onClick={() => select(null)}>
                    <ArrowLeft /> All buses
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
                  <BusDetailPanel insight={selected} onShowQr={() => setQrOpen(true)} />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="shrink-0 space-y-3 border-b border-white/8 p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-semibold">Nearby buses</h2>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <LiveDot tone={status === 'live' ? 'success' : 'muted'} />
                      {status === 'live' ? `${results.length} shown` : 'Not live'}
                    </span>
                  </div>
                  <BusFilterBar filters={filters} onChange={setFilters} locationEnabled={loc.state === 'granted'} resultCount={results.length} />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">{resultsView}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      ) : (
        <>
          <div className="glass-strong absolute inset-x-3 top-3 z-20 space-y-2.5 rounded-2xl p-3">
            <BusFilterBar filters={filters} onChange={setFilters} locationEnabled={loc.state === 'granted'} resultCount={results.length} parts={['search', 'chips']} />
          </div>
          <BottomSheet snap={snap} onSnapChange={setSnap} peek={selected ? PEEK_DETAIL : PEEK_LIST} label={selected ? `${selected.bus.id} details` : 'Nearby buses'}>
            {selected ? (
              <div className="pt-1">
                <BusDetailPanel insight={selected} onClose={() => select(null)} onShowQr={() => setQrOpen(true)} />
              </div>
            ) : (
              <div className="space-y-3 pt-0.5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold">Nearby buses</h2>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <LiveDot tone={status === 'live' ? 'success' : 'muted'} />
                    {status === 'live' ? `${results.length} shown` : 'Not live'}
                  </span>
                </div>
                {snap === 'expanded' && <BusFilterBar filters={filters} onChange={setFilters} locationEnabled={loc.state === 'granted'} resultCount={results.length} parts={['selects']} />}
                {resultsView}
              </div>
            )}
          </BottomSheet>
        </>
      )}

      <QrCodeDialog insight={selected} open={qrOpen} onOpenChange={setQrOpen} />
    </div>
  )
}
