import type { Metadata } from 'next'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { GuidesGrid } from '@/components/guides/GuidesGrid'
import { getAllGuides } from '@/lib/guide-queries'

export const revalidate = 300

export const metadata: Metadata = {
  title: { absolute: 'Guides and Articles | injector.world' },
  description: 'Medically reviewed treatment guides, cost reports, and expert Q&A from the injector.world editorial team.',
  alternates: { canonical: 'https://injector.world/guides' },
}

export default async function GuidesIndexPage() {
  const guides = await getAllGuides()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Guides and Articles | injector.world',
    url: `${siteUrl}/guides`,
    description: 'Medically reviewed injectable treatment guides from the injector.world editorial team.',
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      <Header />

      {/* Page hero */}
      <section className="bg-surface-warm pt-12 pb-10 md:pt-16 md:pb-12 border-b border-border">
        <div className="max-canvas">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3 block">
            Editorial
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">
            Guides and Articles
          </h1>
          <p className="font-serif text-lede-m md:text-lede text-ink-secondary max-w-2xl">
            Medically reviewed guides, cost reports, and expert interviews. Written by health journalists, reviewed by board-certified physicians.
          </p>
        </div>
      </section>

      <GuidesGrid guides={guides} />

      <Footer />
    </>
  )
}
