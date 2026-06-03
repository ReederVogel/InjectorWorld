import { Header } from '@/components/header/Header'
import { Hero } from '@/components/hero/Hero'
import { BodyAreas } from '@/components/body-areas/BodyAreas'
import { BrowseState } from '@/components/browse-state/BrowseState'
import { TrustBar } from '@/components/trust-bar/TrustBar'
import { FeaturedInjectors } from '@/components/featured-injectors/FeaturedInjectors'
import { BrowseTreatments } from '@/components/browse-treatments/BrowseTreatments'
import { BlogsGuides } from '@/components/blogs-guides/BlogsGuides'
import { HowWeVerify } from '@/components/verify/HowWeVerify'
import { PatientStories } from '@/components/patient-stories/PatientStories'
import { VideosSocial } from '@/components/videos-social/VideosSocial'
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
    target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/search?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
}

export default async function HomePage() {
  const { states, treatments, featuredProviders, guides, beforeAfter } = await getHomePageData()

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
      <Header />
      <Hero />
      <BodyAreas />
      <BrowseState states={states} />
      <TrustBar />
      <FeaturedInjectors providers={featuredProviders} />
      <BrowseTreatments treatments={treatments} />
      <BlogsGuides guides={guides} />
      <HowWeVerify />
      <PatientStories cases={beforeAfter} />
      <VideosSocial />
      <PreFooterCta />
      <Footer />
    </>
  )
}
