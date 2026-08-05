import type { GuideRow } from '@/lib/home-queries'
import { GuideListingCard } from '@/components/shared/GuideListingCard'

/**
 * Client request 2026-07-31: every card the same size, 3 per row (12 guides =
 * 4 rows), and no category badges. The oversized first card (`FeaturedGuideCard`,
 * lg:col-span-2) was what made the grid uneven, so it is gone and every guide now
 * renders through the shared card. The "Treatment Guide" / "Article" / "Cost Report"
 * / "Expert Q&A" pills over the cover image were removed too ("distracting").
 *
 * 2026-08-06: the card itself moved to components/shared/GuideListingCard so the
 * /guides listing renders the identical thing.
 */
export function BlogsGuidesClient({ guides }: { guides: GuideRow[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
      {guides.map((g, i) => (
        <GuideListingCard key={g.id} guide={g} index={i} />
      ))}
    </div>
  )
}
