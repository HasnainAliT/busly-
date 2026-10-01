/**
 * Central place for runtime configuration.
 * Everything here is PUBLIC build-time config (VITE_* values are shipped to the browser).
 * Never put secrets here: map tokens must be domain-restricted public tokens, and any
 * private API key belongs on your backend behind an authenticated proxy.
 */
export const env = {
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? '',
  wsUrl: (import.meta.env.VITE_WS_URL as string | undefined) ?? '',
  mapProvider: ((import.meta.env.VITE_MAP_PROVIDER as string | undefined) ?? 'mock') as 'mock' | 'mapbox' | 'google' | 'osm',
  mapPublicToken: (import.meta.env.VITE_MAP_PUBLIC_TOKEN as string | undefined) ?? '',
}

export const isMockBackend = !env.apiUrl && !env.wsUrl
