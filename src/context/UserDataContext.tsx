import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'

/**
 * Favorites and recents are plain ids only (no personal data). They are kept in localStorage for instant loading
 * and, when signed in to the Busly server, synced to GET/PUT /api/me/data (MongoDB) so they follow the person to other devices.
 */

export type FavoriteKind = 'bus' | 'route' | 'stop'

export interface RecentSearch {
  from: string
  to: string
}

export interface ActivityItem {
  id: string
  text: string
  at: number
}

interface UserDataValue {
  favorites: Record<FavoriteKind, string[]>
  isFavorite: (kind: FavoriteKind, id: string) => boolean
  toggleFavorite: (kind: FavoriteKind, id: string) => boolean
  recentBuses: string[]
  recentSearches: RecentSearch[]
  addRecentBus: (id: string) => void
  addRecentSearch: (s: RecentSearch) => void
  clearRecents: () => void
  activity: ActivityItem[]
  addActivity: (text: string) => void
}

const KEY = 'busly.userdata.v1'

interface Persisted {
  favorites: Record<FavoriteKind, string[]>
  recentBuses: string[]
  recentSearches: RecentSearch[]
  activity: ActivityItem[]
}

const defaults = (): Persisted => ({
  favorites: { bus: ['BUS-104'], route: ['route-a'], stop: ['muet'] },
  recentBuses: ['BUS-104', 'BUS-310', 'BUS-201'],
  recentSearches: [
    { from: 'MUET', to: 'Hyderabad' },
    { from: 'Kotri Station', to: 'MUET' },
  ],
  activity: [
    { id: 'seed-1', text: 'Viewed BUS-104 on Route A', at: Date.now() - 1000 * 60 * 6 },
    { id: 'seed-2', text: 'Searched MUET to Hyderabad', at: Date.now() - 1000 * 60 * 42 },
    { id: 'seed-3', text: 'Saved Route A to favorites', at: Date.now() - 1000 * 60 * 60 * 3 },
  ],
})

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults()
    const p = JSON.parse(raw) as Persisted
    const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 50) : [])
    return {
      favorites: { bus: arr(p.favorites?.bus), route: arr(p.favorites?.route), stop: arr(p.favorites?.stop) },
      recentBuses: arr(p.recentBuses).slice(0, 6),
      recentSearches: Array.isArray(p.recentSearches)
        ? p.recentSearches.filter((s) => typeof s?.from === 'string' && typeof s?.to === 'string').slice(0, 5)
        : [],
      activity: Array.isArray(p.activity)
        ? p.activity.filter((a) => typeof a?.text === 'string' && typeof a?.at === 'number').slice(0, 30)
        : [],
    }
  } catch {
    return defaults()
  }
}

const Ctx = createContext<UserDataValue | null>(null)

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user, mode } = useAuth()
  const [data, setData] = useState<Persisted>(load)
  // Server sync only runs for signed-in users on the real backend, and only after the first server read.
  const syncReady = useRef(false)
  const lastSent = useRef('')

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      /* ignore blocked storage */
    }
  }, [data])

  const userId = user?.id
  useEffect(() => {
    syncReady.current = false
    if (mode !== 'api' || !userId) return
    let alive = true
    fetch('/api/me/data', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load'))))
      .then((json: { data: { favorites: Record<FavoriteKind, string[]>; recentSearches: RecentSearch[] } }) => {
        if (!alive) return
        lastSent.current = JSON.stringify({ favorites: json.data.favorites, recentSearches: json.data.recentSearches })
        setData((d) => ({ ...d, favorites: json.data.favorites, recentSearches: json.data.recentSearches }))
        syncReady.current = true
      })
      .catch(() => {
        /* offline or server error: keep working from local data, try again next sign-in */
      })
    return () => {
      alive = false
    }
  }, [mode, userId])

  useEffect(() => {
    if (!syncReady.current) return
    const payload = JSON.stringify({ favorites: data.favorites, recentSearches: data.recentSearches })
    if (payload === lastSent.current) return
    const t = setTimeout(() => {
      fetch('/api/me/data', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'busly' }, body: payload })
        .then((r) => {
          if (r.ok) lastSent.current = payload
        })
        .catch(() => {})
    }, 600)
    return () => clearTimeout(t)
  }, [data.favorites, data.recentSearches])

  const addActivity = useCallback((text: string) => {
    setData((d) => ({ ...d, activity: [{ id: crypto.randomUUID(), text, at: Date.now() }, ...d.activity].slice(0, 30) }))
  }, [])

  const isFavorite = useCallback((kind: FavoriteKind, id: string) => data.favorites[kind].includes(id), [data.favorites])

  const toggleFavorite = useCallback((kind: FavoriteKind, id: string) => {
    let added = false
    setData((d) => {
      const has = d.favorites[kind].includes(id)
      added = !has
      return {
        ...d,
        favorites: { ...d.favorites, [kind]: has ? d.favorites[kind].filter((x) => x !== id) : [id, ...d.favorites[kind]] },
      }
    })
    return added
  }, [])

  const addRecentBus = useCallback((id: string) => {
    setData((d) => ({ ...d, recentBuses: [id, ...d.recentBuses.filter((x) => x !== id)].slice(0, 6) }))
  }, [])

  const addRecentSearch = useCallback((s: RecentSearch) => {
    setData((d) => ({
      ...d,
      recentSearches: [s, ...d.recentSearches.filter((x) => !(x.from === s.from && x.to === s.to))].slice(0, 5),
    }))
  }, [])

  const clearRecents = useCallback(() => setData((d) => ({ ...d, recentBuses: [], recentSearches: [] })), [])

  const value = useMemo<UserDataValue>(
    () => ({
      favorites: data.favorites,
      isFavorite,
      toggleFavorite,
      recentBuses: data.recentBuses,
      recentSearches: data.recentSearches,
      addRecentBus,
      addRecentSearch,
      clearRecents,
      activity: data.activity,
      addActivity,
    }),
    [data, isFavorite, toggleFavorite, addRecentBus, addRecentSearch, clearRecents, addActivity],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUserData() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useUserData must be used inside <UserDataProvider>')
  return ctx
}
