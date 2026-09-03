import type { GuideCard } from '@/lib/guide-queries'
import { GuideListingCard } from '@/components/shared/GuideListingCard'

// Category filter tabs removed for now (2026-09-03, founder request) — categories
// are not shown anywhere on the site currently. `guide.category` still exists in
// the CMS and can drive filtering again later; this component just renders every
// guide it's given.
export function GuidesGrid({ guides }: { guides: GuideCard[] }) {
  return (
    <section className="section-pad bg-surface-warm">
      <div className="max-canvas">
        {guides.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-body text-ink-secondary">No guides yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {guides.map((guide) => (
              <GuideListingCard key={guide.id} guide={guide} headingLevel={2} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
