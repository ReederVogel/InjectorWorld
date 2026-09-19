/**
 * Placeholder cards shown while a clinic listing is loading (2026-09-10,
 * widened to every listing wait 2026-09-19 under founder decision D4).
 *
 * The point is that the list appears ONCE. Before this, the national list
 * rendered, geo arrived a moment later, and the whole grid was replaced in
 * place -- the visible swap the founder reported. Holding the space for the
 * one real render is what removes it.
 *
 * Shape matches DirectoryClinicCard: 16/9 photo block, then a title, a
 * location line and a rating line, at the same padding and gaps, so nothing
 * moves when the real cards land.
 */

/**
 * One placeholder card. Exported so a listing can append a few of these INSIDE
 * its real grid while Load more is in flight, instead of the grid sitting still
 * under a "Loading..." line.
 */
export function ClinicCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface-canvas overflow-hidden flex flex-col">
      <div className="w-full aspect-[16/9] bg-surface animate-pulse" />
      <div className="flex flex-col flex-1 p-4 gap-2">
        <div className="h-4 w-3/4 rounded-control bg-surface animate-pulse" />
        <div className="h-3 w-1/2 rounded-control bg-surface animate-pulse" />
        <div className="h-3 w-2/5 rounded-control bg-surface animate-pulse" />
      </div>
    </div>
  )
}

/**
 * Placeholder grid shown whenever a listing is fetching a page it is about to
 * REPLACE the grid with: the near-me first paint, a ZIP resolving, and any
 * filter change (2026-09-19, founder decision D4).
 *
 * `className` must be the same grid classes the real grid uses on that page, or
 * the skeleton and the list do not line up and the page jumps when the real
 * cards land. The default is what four of the six listings use.
 *
 * 12 cards, not 24: 12 already fills more than a viewport at every breakpoint,
 * and the page growing downward below the fold moves nothing the visitor is
 * looking at, while 24 pulsing cards is a wall of grey.
 */
export function ClinicCardSkeletonGrid({
  count = 12,
  className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5',
}: {
  count?: number
  className?: string
}) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <ClinicCardSkeleton key={i} />
      ))}
    </div>
  )
}
