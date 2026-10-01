import { useEffect, useRef, useState } from 'react'

/** Rolling history of a numeric value, sampled on an interval. Seeded so charts are never empty on first paint. */
export function useHistory(value: number, { max = 24, everyMs = 3000, seedSpread = 1.5 } = {}) {
  const latest = useRef(value)
  latest.current = value
  const [history, setHistory] = useState<number[]>(() =>
    Array.from({ length: 14 }, (_, i) => Math.max(0, +(value + Math.sin(i * 1.3) * seedSpread * 0.6 + Math.cos(i * 0.7) * seedSpread * 0.4).toFixed(1))),
  )
  useEffect(() => {
    const id = setInterval(() => setHistory((h) => [...h.slice(-(max - 1)), latest.current]), everyMs)
    return () => clearInterval(id)
  }, [max, everyMs])
  return history
}
