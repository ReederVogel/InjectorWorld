import Image from 'next/image'
import Link from 'next/link'
import type { NewsCard } from '@/lib/news-queries'

const CATEGORY_LABELS: Record<string, string> = {
  'treatment-update': 'Treatment Update',
  industry: 'Industry',
  company: 'Company',
  announcement: 'Announcement',
  'product-launch': 'Product Launch',
  research: 'Research',
  regulation: 'Regulation',
}

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function NewsCardCompact({ article }: { article: NewsCard }) {
  return (
    <Link
      href={`/news/${article.slug}`}
      className="group flex flex-col rounded-2xl border border-border bg-surface overflow-hidden hover:shadow-hover transition-shadow"
    >
      {article.coverImageUrl ? (
        <div className="relative w-full aspect-[16/9] overflow-hidden bg-surface-warm">
          <Image
            src={article.coverImageUrl}
            alt={article.title}
            fill
            sizes="(min-width:1024px) 320px, (min-width:640px) 50vw, 100vw"
            className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="w-full aspect-[16/9] bg-surface-warm" />
      )}

      <div className="flex flex-col p-4 flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-pill bg-brand-accent-soft text-brand-accent">
            {CATEGORY_LABELS[article.category] ?? article.category}
          </span>
          {article.publishedAt && (
            <span className="text-[11px] text-ink-tertiary">{formatDate(article.publishedAt)}</span>
          )}
        </div>
        <h3 className="font-serif text-[17px] leading-snug font-medium text-ink-primary group-hover:text-brand-accent transition-colors line-clamp-3">
          {article.title}
        </h3>
        <p className="mt-2 text-body-sm text-ink-secondary leading-relaxed line-clamp-2 flex-1">
          {article.excerpt}
        </p>
      </div>
    </Link>
  )
}

export function LatestNews({ articles }: { articles: NewsCard[] }) {
  if (articles.length === 0) return null

  return (
    <section className="bg-surface-canvas py-16 md:py-24 border-t border-border">
      <div className="max-canvas">
        <div className="flex items-end justify-between mb-8 md:mb-10">
          <div>
            <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent block mb-2">
              Latest News
            </span>
            <h2 className="font-serif text-h2-m md:text-h2 text-ink-primary leading-tight">
              What is happening in aesthetics.
            </h2>
          </div>
          <Link
            href="/news"
            className="hidden sm:flex items-center gap-1.5 text-body-sm font-medium text-brand-accent hover:underline flex-shrink-0 ml-6"
          >
            See all news
            <svg
              width="12"
              height="12"
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
            <NewsCardCompact key={article.id} article={article} />
          ))}
        </div>

        <div className="mt-8 sm:hidden">
          <Link
            href="/news"
            className="flex items-center gap-1.5 text-body-sm font-medium text-brand-accent hover:underline"
          >
            See all news
            <svg
              width="12"
              height="12"
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
