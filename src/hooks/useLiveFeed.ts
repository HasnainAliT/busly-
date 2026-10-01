import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { getLiveFeed, type FeedEvent } from '@/services/liveFeed'
import { getBusInsight, type BusInsight } from '@/utils/bus'
import type { Analytics } from '@/domain/analytics'
import type { TransitData } from '@/types'

export function useLiveFeed() {
  const feed = getLiveFeed()
  const snapshot = useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getSnapshot)
  return { ...snapshot, feed }
}

/** Everything the transit system knows right now: stops, routes, buses, drivers, trips, alerts. */
export function useTransit(): TransitData & { status: ReturnType<typeof useLiveFeed>['status']; feed: ReturnType<typeof useLiveFeed>['feed']; lastSync: number } {
  const { data, status, feed, lastSync } = useLiveFeed()
  return { ...data, status, feed, lastSync }
}

export function useBuses() {
  const { buses, status, lastSync, feed } = useLiveFeed()
  const insights = useMemo(() => buses.map(getBusInsight), [buses])
  return { buses, insights, status, lastSync, feed }
}

export function useBusInsight(id: string | undefined): { insight: BusInsight | null; status: ReturnType<typeof useLiveFeed>['status'] } {
  const { buses, status } = useLiveFeed()
  const bus = useMemo(() => buses.find((b) => b.id === id), [buses, id])
  const insight = useMemo(() => (bus ? getBusInsight(bus) : null), [bus])
  return { insight, status }
}

/** Re-renders on an interval so relative timestamps ("12 sec ago") stay honest. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function useFeedEvents(handler: (e: FeedEvent) => void) {
  const feed = getLiveFeed()
  const ref = useRef(handler)
  ref.current = handler
  const stable = useCallback((e: FeedEvent) => ref.current(e), [])
  useEffect(() => feed.onEvent(stable), [feed, stable])
}

/** Analytics from the store: computed locally in demo mode, fetched from the server in API mode. */
export function useAnalytics(refreshMs = 4000) {
  const feed = getLiveFeed()
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let alive = true
    const load = () =>
      feed
        .getAnalytics()
        .then((a) => {
          if (alive) {
            setAnalytics(a)
            setError(false)
          }
        })
        .catch(() => alive && setError(true))
    void load()
    const id = setInterval(load, refreshMs)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [feed, refreshMs])
  return { analytics, error }
}
