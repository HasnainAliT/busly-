import { useCallback, useEffect, useRef, useState } from 'react'

export type GpsState = 'idle' | 'requesting' | 'tracking' | 'denied' | 'unavailable' | 'error'

export interface GpsFix {
  lat: number
  lng: number
  /** km/h */
  speedKmh: number
  accuracyM: number
  at: number
}

/**
 * Wraps navigator.geolocation.watchPosition for the driver app.
 * Browsers only allow it on https or localhost, and only after the driver agrees in the permission prompt.
 */
export function useGps(enabled: boolean) {
  const [state, setState] = useState<GpsState>('idle')
  const [fix, setFix] = useState<GpsFix | null>(null)
  const watchId = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (watchId.current != null && typeof navigator !== 'undefined' && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
  }, [])

  useEffect(() => {
    if (!enabled) {
      stop()
      setState('idle')
      return
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState('unavailable')
      return
    }
    setState('requesting')
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState('tracking')
        setFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speedKmh: pos.coords.speed != null && Number.isFinite(pos.coords.speed) ? Math.round(pos.coords.speed * 3.6) : 0,
          accuracyM: Math.round(pos.coords.accuracy),
          at: Date.now(),
        })
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.POSITION_UNAVAILABLE ? 'unavailable' : 'error'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    )
    return stop
  }, [enabled, stop])

  return { state, fix }
}
