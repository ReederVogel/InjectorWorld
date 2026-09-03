import type { NewsCard } from '@/lib/news-queries'
import { NewsListingCard } from '@/components/shared/NewsListingCard'

// Category filter tabs removed for now (2026-09-03, founder request) — categories
// are not shown anywhere on the site currently. `article.category` still exists
// in the CMS and can drive filtering again later; this component just renders
// every article it's given.
export function NewsGrid({ articles }: { articles: NewsCard[] }) {
  return (
    <section className="section-pad bg-surface-canvas">
      <div className="max-canvas">
        {articles.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-body text-ink-secondary">No articles yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <NewsListingCard key={article.id} article={article} headingLevel={2} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
