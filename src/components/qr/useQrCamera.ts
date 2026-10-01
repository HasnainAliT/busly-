import { useCallback, useEffect, useRef, useState } from 'react'

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike
}

export type CameraState = 'idle' | 'starting' | 'active' | 'denied' | 'unsupported' | 'error'

/**
 * Real camera QR scanning where the browser provides BarcodeDetector (Chromium, Safari 17+ behind flags vary).
 * Falls back to 'unsupported' so the UI can offer the simulated scanner instead of breaking.
 * Integration point: swap detection for a WASM decoder (e.g. zxing / jsQR) to support every browser.
 */
export function useQrCamera(onDetect: (raw: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const detectRef = useRef(onDetect)
  detectRef.current = onDetect
  const [state, setState] = useState<CameraState>('idle')

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setState('idle')
  }, [])

  const start = useCallback(async () => {
    const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) return setState('unsupported')
    setState('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return stop()
      video.srcObject = stream
      await video.play()
      setState('active')
      const detector = new Ctor({ formats: ['qr_code'] })
      let last = 0
      const loop = async (t: number) => {
        if (!streamRef.current) return
        if (t - last > 250) {
          last = t
          try {
            const found = await detector.detect(video)
            if (found[0]?.rawValue) {
              detectRef.current(found[0].rawValue)
              return
            }
          } catch {
            /* a single failed frame is fine */
          }
        }
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      const name = (err as DOMException)?.name
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error')
    }
  }, [stop])

  useEffect(() => stop, [stop])

  return { videoRef, state, start, stop }
}
