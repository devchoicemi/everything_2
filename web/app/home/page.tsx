import { MarketingNav } from '@/components/marketing/MarketingNav'
import { Hero } from '@/components/marketing/Hero'
import { ValueMarquee } from '@/components/marketing/ValueMarquee'
import { Differentiator } from '@/components/marketing/Differentiator'
import { HowItWorks } from '@/components/marketing/HowItWorks'
import { NoPhotoShowcase } from '@/components/marketing/NoPhotoShowcase'
import { CompatibilityEngine } from '@/components/marketing/CompatibilityEngine'
import { SafetySection } from '@/components/marketing/SafetySection'
import { Pricing } from '@/components/marketing/Pricing'
import { FAQ } from '@/components/marketing/FAQ'
import { FinalCTA } from '@/components/marketing/FinalCTA'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'

/**
 * The real marketing site — moved here from "/" while that's showing the
 * ComingSoon holding page (see app/page.tsx). Anyone with this direct link
 * still sees the full site; it's just no longer the public default. Move
 * this back to "/" (and delete app/page.tsx's ComingSoon swap) once ready
 * to go live again.
 */
export default function HomePage() {
  return (
    <>
      <MarketingNav />
      <main>
        <Hero />
        <ValueMarquee />
        <Differentiator />
        <HowItWorks />
        <NoPhotoShowcase />
        <CompatibilityEngine />
        <SafetySection />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <MarketingFooter />
    </>
  )
}
