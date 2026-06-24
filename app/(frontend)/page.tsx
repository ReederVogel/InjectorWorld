import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Hero } from '@/components/hero/Hero'
import { BodyAreas } from '@/components/body-areas/BodyAreas'
import { BrowseState } from '@/components/browse-state/BrowseState'
import { TrustBar } from '@/components/trust-bar/TrustBar'
import { FeaturedInjectors } from '@/components/featured-injectors/FeaturedInjectors'
import { BrowseTreatments } from '@/components/browse-treatments/BrowseTreatments'
import { QuizPromoCard } from '@/components/shared/QuizPromoCard'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import { BlogsGuides } from '@/components/blogs-guides/BlogsGuides'
import { LatestNews } from '@/components/news/LatestNews'
import { HowWeVerify } from '@/components/verify/HowWeVerify'
import { PatientStories } from '@/components/patient-stories/PatientStories'
import { PreFooterCta } from '@/components/pre-footer/PreFooterCta'
import { Footer } from '@/components/footer/Footer'
import { getHomePageData } from '@/lib/home-queries'

export const revalidate = 300 // ISR: regenerate every 5 min

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'injector.world',
  url: siteUrl,
  description: 'The trusted guide to verified aesthetic injectors in the United States.',
  logo: `${siteUrl}/logo.png`,
  sameAs: [
    'https://instagram.com/injectorworld',
    'https://tiktok.com/@injectorworld',
  ],
}

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'injector.world',
  url: siteUrl,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${siteUrl}/search?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
}

export default async function HomePage() {
  const { states, treatments, featuredProviders, guides, beforeAfter, latestNews, topClinics } = await getHomePageData()

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema).replace(/</g, '\\u003c') }} />
      <Header />
      <Hero />
      <BodyAreas />
      <BrowseState states={states} />
      <TrustBar />
      <FeaturedInjectors providers={featuredProviders} />
      {topClinics.length > 0 && (
        <section className="section-pad bg-surface-warm border-y border-border">
          <div className="max-canvas">
            <div className="flex items-baseline justify-between mb-8">
              <div>
                <p className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-2">Featured Clinics</p>
                <h2 className="font-serif text-h2 text-ink-primary">Top aesthetic clinics</h2>
              </div>
              <Link href="/clinics" className="text-body-sm text-brand-accent font-medium hover:underline flex items-center gap-1 flex-shrink-0">
                View all clinics
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {topClinics.map((c) => (
                <DirectoryClinicCard key={c.id} c={c} />
              ))}
            </div>
          </div>
        </section>
      )}
      <BrowseTreatments treatments={treatments} />
      <QuizPromoCard />
      <BlogsGuides guides={guides} />
      <LatestNews articles={latestNews} />
      <HowWeVerify />
      <PatientStories cases={beforeAfter} />
      <PreFooterCta />
      <Footer />
    </>
  )
}
