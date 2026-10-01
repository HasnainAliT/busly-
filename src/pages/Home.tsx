import { LandingNav } from '@/components/landing/LandingNav'
import { Hero } from '@/components/landing/Hero'
import { PopularRoutes } from '@/components/landing/PopularRoutes'
import { Features } from '@/components/landing/Features'
import { DemoTour, FinalCta } from '@/components/landing/DemoTour'
import { SecuritySection } from '@/components/security/SecurityOverview'
import { Footer } from '@/components/landing/Footer'

export default function HomePage() {
  return (
    <>
      <LandingNav />
      <main>
        <Hero />
        <PopularRoutes />
        <Features />
        <DemoTour />
        <SecuritySection />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}
