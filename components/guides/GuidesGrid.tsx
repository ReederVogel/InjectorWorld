'use client'

import { useState, useMemo } from 'react'
import type { GuideCard } from '@/lib/guide-queries'
import { GuideListingCard } from '@/components/shared/GuideListingCard'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Treatment Guides', value: 'treatment-guide' },
  { label: 'Articles', value: 'article' },
  { label: 'Expert Q&A', value: 'expert-qa' },
  { label: 'Cost Reports', value: 'cost-report' },
]

export function GuidesGrid({ guides }: { guides: GuideCard[] }) {
  const [activeTab, setActiveTab] = useState('all')

  const filtered = useMemo(
    () => (activeTab === 'all' ? guides : guides.filter((g) => g.category === activeTab)),
    [guides, activeTab],
  )

  const countFor = (cat: string) =>
    cat === 'all' ? guides.length : guides.filter((g) => g.category === cat).length

  return (
    <>
      {/* Sticky filter tabs */}
      <div className="sticky top-[65px] z-20 bg-surface-canvas border-b border-border">
        <div className="max-canvas">
          <div className="flex items-center gap-1.5 overflow-x-auto py-3 scrollbar-none">
            {TABS.map((tab) => {
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

      {/* Guide grid. Warm background as of 2026-08-06 (client request): the
          cards are white, same as the homepage section, so a white page behind
          them left nothing but a hairline border to separate card from page. */}
      <section className="section-pad bg-surface-warm">
        <div className="max-canvas">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-body text-ink-secondary">No guides in this category yet.</p>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className="mt-3 text-brand-accent text-body-sm hover:underline"
              >
                View all guides
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((guide) => (
                <GuideListingCard key={guide.id} guide={guide} headingLevel={2} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
