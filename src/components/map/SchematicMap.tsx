import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { animate } from 'framer-motion'
import { LocateFixed, Maximize2, Minus, Plus } from 'lucide-react'
import { cn, clamp, lerp } from '@/lib/utils'
import { mapGeometry, routes, stops } from '@/data/mockRoutes'
import { getRouteGeometry, routePathD, routePathUntil } from '@/utils/geometry'
import { BusMarker, DestinationMarker, EtaChip, StopMarker, UserMarker } from '@/components/map/Markers'
import { MapLegend } from '@/components/map/MapLegend'
import type { MapInset, MapViewProps } from '@/components/map/types'

const WORLD_W = 1000
const WORLD_H = 700
const MOVE_MS = 5500

interface Camera {
  cx: number
  cy: number
  s: number
}

const NO_INSET: MapInset = { top: 0, right: 0, bottom: 0, left: 0 }
const easeOut = [0.22, 1, 0.36, 1] as const

/**
 * A map-style, dependency-free renderer: districts, river, roads, routes and live markers drawn in SVG.
 * It implements MapViewProps, so a Mapbox/Google/OSM component can replace it with the same inputs.
 * Markers are drawn at a constant pixel size by counter-scaling against the camera zoom.
 */
function SchematicMapBase({
  buses,
  selectedBusId,
  onSelectBus,
  userPosition,
  fitRouteId = null,
  focusInset,
  interactive = true,
  showControls = true,
  showLegend = true,
  showAllRouteLines = true,
  focusZoom = 2.4,
  followSelected = true,
  className,
  ariaLabel = 'Live bus map',
}: MapViewProps) {
  const uid = useId().replace(/:/g, '')
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [cam, setCam] = useState<Camera | null>(null)
  const camRef = useRef<Camera | null>(null)
  const animRef = useRef<{ stop: () => void } | null>(null)
  const dragRef = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null)
  const justDragged = useRef(false)
  const followRef = useRef(true)
  const [hoverId, setHoverId] = useState<string | null>(null)

  const inset = useMemo<MapInset>(() => ({ ...NO_INSET, ...focusInset }), [focusInset])
  const insetRef = useRef(inset)
  insetRef.current = inset

  const selected = useMemo(() => buses.find((b) => b.bus.id === selectedBusId) ?? null, [buses, selectedBusId])
  const selectedRef = useRef(selected)
  selectedRef.current = selected

  /* ---------- sizing ---------- */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((prev) => (Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1 ? prev : { w: width, h: height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fit = size.w && size.h ? Math.min(size.w / WORLD_W, size.h / WORLD_H) : 1
  const minS = fit * 0.85
  const maxS = fit * 7

  const homeCamera = useCallback((): Camera => {
    const narrow = size.w < 560
    return { cx: narrow ? 450 : 500, cy: narrow ? 340 : 350, s: fit * (narrow ? 1.5 : 1.04) }
  }, [fit, size.w])

  const applyCamera = useCallback((c: Camera) => {
    camRef.current = c
    setCam(c)
  }, [])

  const animateTo = useCallback(
    (target: Camera, duration = 0.8) => {
      const from = camRef.current
      animRef.current?.stop()
      if (!from) return applyCamera(target)
      animRef.current = animate(0, 1, {
        duration,
        ease: duration > 1 ? 'linear' : easeOut,
        onUpdate: (t) => {
          // Interpolate zoom in log space so zooming feels even.
          const s = Math.exp(lerp(Math.log(from.s), Math.log(target.s), t))
          applyCamera({ cx: lerp(from.cx, target.cx, t), cy: lerp(from.cy, target.cy, t), s })
        },
      })
    },
    [applyCamera],
  )

  /** Camera that puts `p` in the middle of the part of the map not covered by overlays. */
  const cameraFor = useCallback(
    (p: { x: number; y: number }, s: number): Camera => {
      const i = insetRef.current
      const visCx = (i.left + (size.w - i.right)) / 2
      const visCy = (i.top + (size.h - i.bottom)) / 2
      return { cx: p.x - (visCx - size.w / 2) / s, cy: p.y - (visCy - size.h / 2) / s, s }
    },
    [size.w, size.h],
  )

  const routeFitCamera = useCallback(
    (routeId: string): Camera | null => {
      const route = routes.find((r) => r.id === routeId)
      if (!route || !size.w) return null
      const pts = getRouteGeometry(route).points
      const xs = pts.map((p) => p.x)
      const ys = pts.map((p) => p.y)
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
      const i = insetRef.current
      const availW = Math.max(120, size.w - i.left - i.right - 80)
      const availH = Math.max(120, size.h - i.top - i.bottom - 120)
      const s = clamp(Math.min(availW / Math.max(maxX - minX, 60), availH / Math.max(maxY - minY, 60)), minS, maxS)
      return cameraFor({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, s)
    },
    [size.w, size.h, minS, maxS, cameraFor],
  )

  /* ---------- initial camera ---------- */
  useEffect(() => {
    if (!size.w || camRef.current) return
    applyCamera(homeCamera())
  }, [size.w, homeCamera, applyCamera])

  /* ---------- focus on selection / route ---------- */
  const selId = selected?.bus.id ?? null
  useEffect(() => {
    if (!camRef.current) return
    followRef.current = true
    const sel = selectedRef.current
    if (sel) {
      animateTo(cameraFor(sel.position, clamp(fit * focusZoom, minS, maxS)), 0.85)
    } else if (fitRouteId) {
      const c = routeFitCamera(fitRouteId)
      if (c) animateTo(c, 0.85)
    } else {
      animateTo(homeCamera(), 0.7)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, fitRouteId, size.w, size.h, inset.left, inset.right, inset.top, inset.bottom])

  /* ---------- follow the selected bus while it moves ---------- */
  const followKey = selected ? `${selected.position.x.toFixed(1)}:${selected.position.y.toFixed(1)}` : ''
  useEffect(() => {
    const sel = selectedRef.current
    if (!sel || !followSelected || !followRef.current || !camRef.current) return
    animateTo(cameraFor(sel.position, camRef.current.s), 1.6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followKey])

  /* ---------- pan ---------- */
  const onPointerDown = (e: ReactPointerEvent) => {
    if (!interactive || e.button !== 0 || !camRef.current) return
    animRef.current?.stop()
    const start = { x: e.clientX, y: e.clientY, cx: camRef.current.cx, cy: camRef.current.cy, moved: false }
    dragRef.current = start
    const move = (ev: PointerEvent) => {
      const c = camRef.current
      if (!c) return
      const dx = ev.clientX - start.x
      const dy = ev.clientY - start.y
      if (!start.moved && Math.hypot(dx, dy) > 5) {
        start.moved = true
        followRef.current = false
      }
      if (start.moved) applyCamera({ ...c, cx: start.cx - dx / c.s, cy: start.cy - dy / c.s })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      justDragged.current = start.moved
      setTimeout(() => (justDragged.current = false), 0)
      dragRef.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const zoomBy = (factor: number) => {
    const c = camRef.current
    if (!c) return
    followRef.current = false
    animateTo({ ...c, s: clamp(c.s * factor, minS, maxS) }, 0.35)
  }

  const recenter = () => {
    followRef.current = true
    if (selected) return animateTo(cameraFor(selected.position, clamp(fit * focusZoom, minS, maxS)), 0.7)
    if (userPosition) return animateTo(cameraFor(userPosition, clamp(fit * 2, minS, maxS)), 0.7)
    animateTo(homeCamera(), 0.7)
  }

  const handleSelect = useCallback(
    (id: string) => {
      if (justDragged.current) return
      onSelectBus(id)
    },
    [onSelectBus],
  )

  /* ---------- derived render data ---------- */
  const view = cam && size.w ? { w: size.w / cam.s, h: size.h / cam.s, x: cam.cx - size.w / cam.s / 2, y: cam.cy - size.h / cam.s / 2 } : null
  const scale = cam?.s ?? 1
  const zoomedIn = cam ? cam.s > fit * 1.8 : false
  const activeRoute = selected?.route ?? (fitRouteId ? routes.find((r) => r.id === fitRouteId) ?? null : null)
  const selectedRouteStopIds = new Set(activeRoute?.stopIds ?? [])
  const destination = activeRoute ? stops.find((s) => s.id === activeRoute.stopIds[activeRoute.stopIds.length - 1]) : null

  return (
    <div
      ref={wrapRef}
      className={cn('relative isolate overflow-hidden bg-[hsl(168_45%_8%)]', className)}
      role="application"
      aria-label={ariaLabel}
    >
      {view && (
        <svg
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          width={size.w}
          height={size.h}
          className={cn('absolute inset-0 block select-none', interactive && 'cursor-grab active:cursor-grabbing')}
          style={{ touchAction: interactive ? 'none' : 'auto' }}
          onPointerDown={onPointerDown}
          onClick={() => {
            if (!justDragged.current && selectedBusId) onSelectBus(null)
          }}
        >
          <defs>
            <pattern id={`${uid}-blocks`} width="34" height="26" patternUnits="userSpaceOnUse">
              <rect x="3" y="3" width="22" height="14" rx="3" fill="white" fillOpacity=".045" />
              <rect x="27" y="9" width="5" height="14" rx="2" fill="white" fillOpacity=".03" />
            </pattern>
            <linearGradient id={`${uid}-river`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="hsl(186 55% 20%)" />
              <stop offset="1" stopColor="hsl(190 55% 14%)" />
            </linearGradient>
            <radialGradient id={`${uid}-land`} cx="50%" cy="45%" r="75%">
              <stop offset="0" stopColor="hsl(168 38% 12%)" />
              <stop offset="1" stopColor="hsl(168 45% 8%)" />
            </radialGradient>
            <path id={`${uid}-riverpath`} d={mapGeometry.river} />
          </defs>

          {/* land + water */}
          <rect x={-3000} y={-3000} width={7000} height={7000} fill={`url(#${uid}-land)`} />
          <path d={mapGeometry.river} fill="none" stroke={`url(#${uid}-river)`} strokeWidth={64} strokeLinecap="round" />
          <path d={mapGeometry.river} fill="none" stroke="hsl(186 60% 40%)" strokeOpacity={0.12} strokeWidth={50} strokeLinecap="round" />
          <path d={mapGeometry.riverBank} fill="none" stroke="white" strokeOpacity={0.04} strokeWidth={2} />
          <text fontSize={13} fill="hsl(170 40% 62%)" fillOpacity={0.55} letterSpacing=".35em" fontFamily="Plus Jakarta Sans, sans-serif">
            <textPath href={`#${uid}-riverpath`} startOffset="6%">Indus River</textPath>
          </text>

          {/* districts */}
          {mapGeometry.districts.map((d) => (
            <g key={d.id}>
              <rect x={d.x} y={d.y} width={d.w} height={d.h} rx={40} fill={`url(#${uid}-blocks)`} />
              <rect x={d.x} y={d.y} width={d.w} height={d.h} rx={40} fill="hsl(166 32% 16%)" fillOpacity={0.45} stroke="white" strokeOpacity={0.05} />
              <text x={d.x + 24} y={d.y + 34} fontSize={15} fontWeight={700} fill="white" fillOpacity={0.3} letterSpacing=".06em" fontFamily="Sora, sans-serif">
                {d.label}
              </text>
            </g>
          ))}
          <ellipse cx={190} cy={125} rx={85} ry={46} fill="hsl(160 45% 28%)" fillOpacity={0.14} />
          <ellipse cx={850} cy={365} rx={70} ry={34} fill="hsl(160 45% 28%)" fillOpacity={0.12} />

          {/* roads */}
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {mapGeometry.minorRoads.map((d, i) => (
              <path key={i} d={d} stroke="white" strokeOpacity={0.07} strokeWidth={5} />
            ))}
            {mapGeometry.highways.map((d, i) => (
              <g key={i}>
                <path d={d} stroke="hsl(166 20% 24%)" strokeWidth={13} />
                <path d={d} stroke="hsl(38 60% 60%)" strokeOpacity={0.35} strokeWidth={1.6} strokeDasharray="14 12" />
              </g>
            ))}
          </g>
          <text x={560} y={522} fontSize={11} fill="white" fillOpacity={0.3} fontFamily="Plus Jakarta Sans, sans-serif" letterSpacing=".08em">M-9 Motorway</text>

          {/* routes */}
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {routes.map((r) => {
              const isActive = activeRoute?.id === r.id
              if (!isActive && !showAllRouteLines) return null
              const d = routePathD(r)
              const colour = `hsl(${r.hue} 90% 62%)`
              return (
                <g key={r.id}>
                  {isActive ? (
                    <>
                      <path d={d} stroke={colour} strokeOpacity={0.18} strokeWidth={16} />
                      <path d={d} stroke={colour} strokeOpacity={0.5} strokeWidth={5.5} />
                      {selected && <path d={routePathUntil(r, selected.bus.progress)} stroke="hsl(160 20% 72%)" strokeOpacity={0.55} strokeWidth={5.5} />}
                      <path d={d} stroke="white" strokeOpacity={0.9} strokeWidth={2} strokeDasharray="2 12" className="route-flow" />
                    </>
                  ) : (
                    <path d={d} stroke={colour} strokeOpacity={activeRoute ? 0.12 : 0.34} strokeWidth={4} />
                  )}
                </g>
              )
            })}
          </g>

          {/* stops */}
          {stops.map((s) => {
            const onActive = selectedRouteStopIds.has(s.id)
            const passed =
              !!selected && onActive && selected.stops.findIndex((x) => x.id === s.id) <= selected.currentStopIndex
            return (
              <StopMarker
                key={s.id}
                x={s.x}
                y={s.y}
                name={s.name}
                scale={scale}
                showLabel={onActive || zoomedIn}
                passed={passed}
                highlight={onActive}
                hue={activeRoute?.hue ?? 199}
              />
            )
          })}

          {destination && <DestinationMarker x={destination.x} y={destination.y} scale={scale} name={destination.name} />}
          {selected?.nextStop && selected.etaNextMin != null && (
            <EtaChip x={selected.nextStop.x} y={selected.nextStop.y} scale={scale} minutes={selected.etaNextMin} name={selected.nextStop.name} />
          )}

          {userPosition && <UserMarker x={userPosition.x} y={userPosition.y} scale={scale} />}

          {/* buses (selected on top) */}
          {[...buses]
            .sort((a, b) => Number(a.bus.id === selectedBusId) - Number(b.bus.id === selectedBusId))
            .map((b) => (
              <BusMarker
                key={b.bus.id}
                insight={b}
                scale={scale}
                selected={b.bus.id === selectedBusId}
                hovered={hoverId === b.bus.id}
                dimmed={!!selectedBusId && b.bus.id !== selectedBusId && b.bus.routeId !== selected?.bus.routeId}
                onSelect={handleSelect}
                onHover={setHoverId}
                moveMs={MOVE_MS}
              />
            ))}
        </svg>
      )}

      {/* soft vignette so overlaid UI always reads well */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_20px_hsl(168_45%_6%/.7)]" />

      {showLegend && <MapLegend style={{ left: (inset.left || 0) + 12, bottom: (inset.bottom || 0) + 12 }} />}

      {showControls && interactive && (
        <div
          className="absolute z-10 flex flex-col gap-1.5"
          style={{ right: (inset.right || 0) + 12, bottom: (inset.bottom || 0) + 12 }}
        >
          <div className="glass flex flex-col overflow-hidden rounded-xl">
            <MapButton label="Zoom in" onClick={() => zoomBy(1.6)}><Plus /></MapButton>
            <div className="h-px bg-white/10" />
            <MapButton label="Zoom out" onClick={() => zoomBy(1 / 1.6)}><Minus /></MapButton>
          </div>
          <div className="glass overflow-hidden rounded-xl">
            <MapButton label={selected ? 'Follow selected bus' : 'Center on my location'} onClick={recenter}><LocateFixed /></MapButton>
          </div>
          <div className="glass overflow-hidden rounded-xl">
            <MapButton
              label="Reset map view"
              onClick={() => {
                followRef.current = false
                onSelectBus(null)
                animateTo(homeCamera(), 0.7)
              }}
            >
              <Maximize2 />
            </MapButton>
          </div>
        </div>
      )}
    </div>
  )
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-10 place-items-center text-foreground/85 transition-colors hover:bg-white/10 hover:text-foreground [&_svg]:size-[18px]"
    >
      {children}
    </button>
  )
}

export const SchematicMap = memo(SchematicMapBase)
