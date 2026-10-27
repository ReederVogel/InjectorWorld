'use client'

import { useMemo, useState } from 'react'
import type { GuideCard, GuideCategoryChip } from '@/lib/guide-queries'
import { GuideListingCard } from '@/components/shared/GuideListingCard'
import { FilterChips } from '@/components/shared/FilterChips'

// Category chips are back (2026-10-28), now driven by the guide-categories
// collection instead of the old 4-value `category` select. A guide counts under
// both its primary and secondary categories. The served HTML holds every card;
// a chip only filters in the browser, so no new urls exist for crawlers.
export function GuidesGrid({ guides, categories }: { guides: GuideCard[]; categories: GuideCategoryChip[] }) {
  const [active, setActive] = useState('all')

  const chips = useMemo(
    () => [
      { value: 'all', label: 'All', count: guides.length },
      ...categories
        .map((c) => ({ value: c.slug, label: c.name, count: guides.filter((g) => g.categories.includes(c.slug)).length }))
        .filter((c) => c.count > 0),
    ],
    [guides, categories],
  )
  const shown = active === 'all' ? guides : guides.filter((g) => g.categories.includes(active))

  return (
    <section className="section-pad bg-surface-warm">
      <div className="max-canvas">
        {guides.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-body text-ink-secondary">No guides yet.</p>
          </div>
        ) : (
          <>
            {chips.length > 1 && (
              <FilterChips chips={chips} active={active} onChange={setActive} label="Filter guides by category" />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {shown.map((guide) => (
                <GuideListingCard key={guide.id} guide={guide} headingLevel={2} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
