import type { Metadata } from 'next'
import { staticPageMetadata } from '@/lib/seo-metadata'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { GuidesGrid } from '@/components/guides/GuidesGrid'
import { getAllGuides, getGuideCategories } from '@/lib/guide-queries'

export const revalidate = 300

const PAGE_TITLE = 'Educational Guides and Articles | injector.world'

export function generateMetadata(): Promise<Metadata> {
  return staticPageMetadata(
    '/guides',
    PAGE_TITLE,
    'Medically reviewed treatment guides, cost reports, and expert Q&A from the injector.world editorial team.',
  )
}

export default async function GuidesIndexPage() {
  let guides: Awaited<ReturnType<typeof getAllGuides>> = []
  let categories: Awaited<ReturnType<typeof getGuideCategories>> = []
  try {
    ;[guides, categories] = await Promise.all([getAllGuides(), getGuideCategories()])
  } catch { /* DB unavailable at build time */ }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: PAGE_TITLE,
    url: `${siteUrl}/guides`,
    description: 'Medically reviewed injectable treatment guides from the injector.world editorial team.',
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />

      <Header />
      <main>

        {/* Page hero. Sub text removed 2026-10-28 (founder request). */}
        <section className="bg-surface-warm pt-12 pb-10 md:pt-16 md:pb-12 border-b border-border">
          <div className="max-canvas">
            <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3 block">
              Editorial
            </span>
            <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary">
              Educational Guides and Articles
            </h1>
          </div>
        </section>

        <GuidesGrid guides={guides} categories={categories} />

      </main>
      <Footer />
    </>
  )
}
