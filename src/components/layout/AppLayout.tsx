import { Suspense, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { Topbar } from '@/components/layout/Topbar'
import { QrScannerModal } from '@/components/qr/QrScannerModal'
import { ShellContext } from '@/context/ShellContext'
import { PageFallback } from '@/components/layout/PageFallback'

export function AppLayout() {
  const location = useLocation()
  const [scannerOpen, setScannerOpen] = useState(false)
  const isMap = location.pathname === '/app/map'

  return (
    <ShellContext.Provider value={{ openScanner: () => setScannerOpen(true) }}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <Sidebar />
      <div className="md:pl-[72px] lg:pl-[256px]">
        <Topbar />
        <main
          id="main"
          className={isMap ? 'h-[calc(100dvh-3.5rem-60px-env(safe-area-inset-bottom))] md:h-[calc(100dvh-4rem)]' : 'min-h-[calc(100dvh-3.5rem)] pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-10'}
        >
          <Suspense fallback={<PageFallback />}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                className={isMap ? 'h-full' : ''}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </main>
      </div>
      <MobileNav />
      <QrScannerModal open={scannerOpen} onOpenChange={setScannerOpen} />
    </ShellContext.Provider>
  )
}
