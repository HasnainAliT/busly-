import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useUserData } from '@/context/UserDataContext'

export interface TimelineItem {
  id: string
  text: string
  at: number
  by?: string
}

/** The signed-in person's activity. From the server (MongoDB) when available, otherwise this browser's own log. */
export function useActivityTimeline(opts: { all?: boolean; limit?: number; refreshMs?: number } = {}): { items: TimelineItem[]; loading: boolean; error: boolean } {
  const { user, mode } = useAuth()
  const { activity } = useUserData()
  const [items, setItems] = useState<TimelineItem[] | null>(null)
  const [error, setError] = useState(false)
  const { all = false, limit = 20, refreshMs = 15000 } = opts

  useEffect(() => {
    if (mode !== 'api' || !user) return
    let alive = true
    const load = () =>
      fetch(`/api/activity?limit=${limit}${all ? '&scope=all' : ''}`, { credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load'))))
        .then((j: { activity: { id: string; summary: string; at: number; userName: string }[] }) => {
          if (!alive) return
          setItems(j.activity.map((a) => ({ id: a.id, text: a.summary, at: a.at, by: a.userName })))
          setError(false)
        })
        .catch(() => alive && setError(true))
    void load()
    const id = setInterval(load, refreshMs)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [mode, user, all, limit, refreshMs])

  if (mode !== 'api') return { items: activity.slice(0, limit).map((a): TimelineItem => ({ id: a.id, text: a.text, at: a.at })), loading: false, error: false }
  return { items: items ?? ([] as TimelineItem[]), loading: items === null && !error, error }
}
