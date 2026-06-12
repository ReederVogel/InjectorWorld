import type { Metadata } from 'next'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { NewsGrid } from '@/components/news/NewsGrid'
import { getLatestNews } from '@/lib/news-queries'

export const revalidate = 300

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

export const metadata: Metadata = {
  title: { absolute: 'News | injector.world' },
  description:
    'Treatment updates, industry news, and announcements from the aesthetics world. Curated by the injector.world editorial team.',
  alternates: {
    canonical: `${siteUrl}/news`,
    types: { 'application/rss+xml': `${siteUrl}/news/rss.xml` },
  },
}

export default async function NewsIndexPage() {
  let articles: Awaited<ReturnType<typeof getLatestNews>> = []
  try {
    articles = await getLatestNews()
  } catch {
    // DB unavailable at build time
  }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'News | injector.world',
    url: `${siteUrl}/news`,
    description:
      'Treatment updates, industry news, and announcements from the aesthetics world.',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />

      <Header />

      {/* Page hero */}
      <section className="bg-surface-warm pt-12 pb-10 md:pt-16 md:pb-12 border-b border-border">
        <div className="max-canvas">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3 block">
            News
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">
            Aesthetics News
          </h1>
          <p className="font-serif text-lede-m md:text-lede text-ink-secondary max-w-2xl">
            Treatment updates, industry developments, and announcements. Timely, factual, and free
            of hype.
          </p>
        </div>
      </section>

      <NewsGrid articles={articles} />

      <Footer />
    </>
  )
}
