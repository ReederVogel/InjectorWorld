'use client'

import { useState, useMemo } from 'react'
import type { NewsCard } from '@/lib/news-queries'
import { NewsListingCard } from '@/components/shared/NewsListingCard'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Treatment Update', value: 'treatment-update' },
  { label: 'Industry', value: 'industry' },
  { label: 'Company', value: 'company' },
  { label: 'Announcement', value: 'announcement' },
  { label: 'Product Launch', value: 'product-launch' },
  { label: 'Research', value: 'research' },
  { label: 'Regulation', value: 'regulation' },
]

export function NewsGrid({ articles }: { articles: NewsCard[] }) {
  const [activeTab, setActiveTab] = useState('all')

  const filtered = useMemo(
    () => (activeTab === 'all' ? articles : articles.filter((a) => a.category === activeTab)),
    [articles, activeTab],
  )

  const countFor = (cat: string) =>
    cat === 'all' ? articles.length : articles.filter((a) => a.category === cat).length

  const visibleTabs = TABS.filter((t) => t.value === 'all' || countFor(t.value) > 0)

  return (
    <>
      {/* Sticky filter tabs */}
      <div className="sticky top-[65px] z-20 bg-surface-canvas border-b border-border">
        <div className="max-canvas">
          <div className="flex items-center gap-1.5 overflow-x-auto py-3 scrollbar-none">
            {visibleTabs.map((tab) => {
              const count = countFor(tab.value)
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex-shrink-0 px-4 py-2 rounded-control text-body-sm font-medium transition ${
                    activeTab === tab.value
                      ? 'bg-brand-primary text-surface-canvas'
                      : 'bg-surface text-ink-secondary hover:bg-surface-warm hover:text-ink-primary border border-border'
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={`ml-1.5 text-[11px] ${
                        activeTab === tab.value ? 'text-surface-canvas/70' : 'text-ink-tertiary'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Grid */}
      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-body text-ink-secondary">No articles in this category yet.</p>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className="mt-3 text-brand-accent text-body-sm hover:underline"
              >
                View all news
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((article) => (
                <NewsListingCard key={article.id} article={article} headingLevel={2} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
