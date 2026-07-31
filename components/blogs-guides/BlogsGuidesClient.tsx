import Image from 'next/image'
import Link from 'next/link'
import type { GuideRow } from '@/lib/home-queries'

/**
 * Client request 2026-07-31: every card the same size, 3 per row (12 guides =
 * 4 rows), and no category badges. The oversized first card (`FeaturedGuideCard`,
 * lg:col-span-2) was what made the grid uneven, so it is gone and every guide now
 * renders through GuideCard. The "Treatment Guide" / "Article" / "Cost Report" /
 * "Expert Q&A" pills over the cover image were removed too ("distracting"), which
 * also retires categoryLabel/categoryBadgeClass.
 */
export function BlogsGuidesClient({ guides }: { guides: GuideRow[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
      {guides.map((g, i) => (
        <GuideCard key={g.id} g={g} index={i} />
      ))}
    </div>
  )
}

function GuideCard({ g, index }: { g: GuideRow; index: number }) {
  const date = g.lastMedicallyReviewed ? new Date(g.lastMedicallyReviewed) : null
  return (
    <Link
      href={`/guides/${g.slug}`}
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
      className="group bg-surface-canvas border border-border rounded-2xl overflow-hidden block animate-fade-up transition hover:shadow-hover hover:-translate-y-1 duration-300"
    >
      <div className="relative h-[200px] bg-surface overflow-hidden">
        {g.coverImageUrl && (
          <Image src={g.coverImageUrl} alt={g.title} fill sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
        )}
      </div>
      <div className="p-6">
        <h3 className="font-serif text-h3-m mb-3 text-ink-primary leading-tight line-clamp-2 group-hover:text-brand-accent transition">{g.title}</h3>
        <p className="text-body-sm text-ink-secondary leading-[1.55] mb-5 line-clamp-3">{g.lede}</p>

        {g.reviewer && (
          <div className="flex items-center gap-2 mb-3">
            <div className="relative w-8 h-8 rounded-full overflow-hidden bg-surface flex-shrink-0">
              {g.reviewer.photoUrl && <Image src={g.reviewer.photoUrl} alt={g.reviewer.fullName} fill sizes="32px" className="object-cover" />}
            </div>
            <div className="text-caption text-ink-secondary truncate">Reviewed by <span className="font-medium text-ink-primary">{g.reviewer.fullName}</span></div>
          </div>
        )}

        <div className="flex items-center justify-between text-caption text-ink-tertiary border-t border-border-subtle pt-3">
          <span className="flex items-center gap-1">
            {g.readTimeMin && (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                {g.readTimeMin} min read
              </>
            )}
          </span>
          <span className="flex items-center gap-1">
            {date && (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                {date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              </>
            )}
          </span>
        </div>
      </div>
    </Link>
  )
}
