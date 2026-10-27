'use client'

import { useMemo, useState } from 'react'
import type { NewsCard } from '@/lib/news-queries'
import { NewsListingCard } from '@/components/shared/NewsListingCard'
import { FilterChips } from '@/components/shared/FilterChips'

// Month chips (founder request 2026-10-28), newest month first, counted by the
// publish date's UTC month (the same day the card shows). The served HTML holds
// every article; a chip only filters in the browser, so no new urls exist.
const monthKey = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 7) : undefined)
const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

export function NewsGrid({ articles }: { articles: NewsCard[] }) {
  const [active, setActive] = useState('all')

  const chips = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of articles) {
      const key = monthKey(a.publishedAt)
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const months = [...counts.keys()].sort().reverse()
    return [
      { value: 'all', label: 'All', count: articles.length },
      ...months.map((m) => ({ value: m, label: monthLabel(m), count: counts.get(m)! })),
    ]
  }, [articles])
  const shown = active === 'all' ? articles : articles.filter((a) => monthKey(a.publishedAt) === active)

  return (
    <section className="section-pad bg-surface-canvas">
      <div className="max-canvas">
        {articles.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-body text-ink-secondary">No articles yet.</p>
          </div>
        ) : (
          <>
            {chips.length > 2 && (
              <FilterChips chips={chips} active={active} onChange={setActive} label="Filter news by month" />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {shown.map((article) => (
                <NewsListingCard key={article.id} article={article} headingLevel={2} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
