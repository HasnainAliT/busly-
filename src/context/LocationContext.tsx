import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { DEMO_USER_POSITION } from '@/data/mockRoutes'

/**
 * Simulated location permission. The prototype does NOT read real GPS because the map is schematic.
 * Integration point: call navigator.geolocation.getCurrentPosition inside `request()`, map the result
 * into map coordinates, and keep the position in memory only (do not persist or upload it unless the
 * rider explicitly shares a trip).
 */
export type LocationState = 'granted' | 'denied' | 'requesting'

interface LocationValue {
  state: LocationState
  position: { x: number; y: number } | null
  request: () => void
  disable: () => void
}

const Ctx = createContext<LocationValue | null>(null)

export function LocationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LocationState>('granted')

  const request = useCallback(() => {
    setState('requesting')
    setTimeout(() => setState('granted'), 800)
  }, [])
  const disable = useCallback(() => setState('denied'), [])

  const value = useMemo<LocationValue>(
    () => ({ state, position: state === 'granted' ? DEMO_USER_POSITION : null, request, disable }),
    [state, request, disable],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLocationAccess() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLocationAccess must be used inside <LocationProvider>')
  return ctx
}
