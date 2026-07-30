import { Header } from '@/components/header/Header'
import { Hero } from '@/components/hero/Hero'
import { FeaturedInjectors } from '@/components/featured-injectors/FeaturedInjectors'
import { BrowseServices } from '@/components/browse-services/BrowseServices'
import { FeaturedClinicsSection } from '@/components/clinics/FeaturedClinicsSection'
import { BlogsGuides } from '@/components/blogs-guides/BlogsGuides'
import { LatestNews } from '@/components/news/LatestNews'
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
  const { treatments, featuredProviders, guides, latestNews, topClinics } = await getHomePageData()

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema).replace(/</g, '\\u003c') }} />
      <Header />
      <Hero />
      {/* Hidden for go-live (client request 2026-07-30). These three sections are
          being reworked and will come back after launch. Components are untouched
          and unused elsewhere. Uncomment the three lines to restore.
            <HomepageStateMap />   "Find by state" US map
            <TrustBar />           "The numbers" stats
            <HowWeVerify />        "How we verify" (below LatestNews)
          The standalone /how-we-verify page has its own component and is unaffected. */}
      {featuredProviders.length > 0 && <FeaturedInjectors providers={featuredProviders} />}
      <FeaturedClinicsSection fallback={topClinics} />
      <BrowseServices treatments={treatments} />
      <BlogsGuides guides={guides} />
      <LatestNews articles={latestNews} />
      <PreFooterCta />
      <Footer />
    </>
  )
}
