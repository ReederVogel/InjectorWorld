import Link from 'next/link'
import type { NewsCard } from '@/lib/news-queries'
import { NewsListingCard } from '@/components/shared/NewsListingCard'

export function LatestNews({ articles }: { articles: NewsCard[] }) {
  if (articles.length === 0) return null

  return (
    <section className="bg-surface-canvas py-16 md:py-24 border-t border-border">
      <div className="max-canvas">
        <div className="flex items-end justify-between mb-8 md:mb-10">
          <div>
            {/* Subtext removed 2026-07-31 (client request). */}
            <h2 className="font-serif text-h2-m md:text-h2 text-ink-primary leading-tight">
              Latest News
            </h2>
          </div>
          <Link
            href="/news"
            className="hidden sm:flex items-center gap-1.5 text-body-lg font-semibold text-brand-accent hover:underline flex-shrink-0 ml-6"
          >
            See all news
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.slice(0, 3).map((article) => (
            <NewsListingCard key={article.id} article={article} />
          ))}
        </div>

        <div className="mt-8 sm:hidden">
          <Link
            href="/news"
            className="flex items-center gap-1.5 text-body-lg font-semibold text-brand-accent hover:underline"
          >
            See all news
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  )
}
