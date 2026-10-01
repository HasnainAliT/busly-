import { seedBusIds } from '@/domain/seed'

export const BUS_ID_PATTERN = /^BUS-\d{3,4}$/

/** Live list of bus ids. The store keeps it in sync, so QR payload validation always checks the current fleet. */
export const knownBusIds: string[] = seedBusIds()

export function syncKnownBusIds(ids: string[]) {
  knownBusIds.splice(0, knownBusIds.length, ...ids)
}
