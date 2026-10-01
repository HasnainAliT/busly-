import { afterEach } from 'vitest'

// Server tests run in the node environment and need none of the DOM shims below.
const hasDom = typeof window !== 'undefined'
if (hasDom) {
  await import('@testing-library/jest-dom/vitest')
  const { cleanup } = await import('@testing-library/react')
  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    localStorage.clear()
  })
}

if (hasDom) {
  /* jsdom lacks these browser APIs that the app (and framer-motion) rely on. */
  class MockResizeObserver {
    cb: ResizeObserverCallback
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb
    }
    observe(el: Element) {
      queueMicrotask(() =>
        this.cb([{ target: el, contentRect: { width: 1000, height: 700 } as DOMRectReadOnly } as ResizeObserverEntry], this as unknown as ResizeObserver),
      )
    }
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

  window.matchMedia =
    window.matchMedia ??
    ((query: string) =>
      ({
        matches: query.includes('min-width'),
        media: query,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => false,
        onchange: null,
      }) as unknown as MediaQueryList)

  Element.prototype.scrollIntoView = () => {}

}
