import type { Trip } from './types'

/** Real-world minutes the trip took, undoing the demo time multiplier. */
export const actualMinutes = (t: Trip): number => (t.endTime == null ? 0 : ((t.endTime - t.startTime) / 6e4) * (t.scale ?? 1))
