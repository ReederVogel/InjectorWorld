import Link from 'next/link'
import type { TopResult } from '@/lib/search-content'

const TYPE_LABEL: Record<TopResult['type'], string> = {
  treatment: 'Service',
  guide: 'Guide',
  news: 'News',
  brand: 'Brand',
}

/**
 * "Top results" strip on /search: matching guides / news / treatment pillars /
 * brand hubs, shown above the provider + clinic directory results so search reads
 * like true site search.
 */
export function TopResults({ results }: { results: TopResult[] }) {
  if (results.length === 0) return null
  return (
    <div className="mb-10">
      <h2 className="text-overline uppercase tracking-widest font-semibold text-ink-tertiary mb-4">
        Top results
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {results.map((r) => (
          <Link
            key={`${r.type}-${r.href}`}
            href={r.href}
            className="group flex flex-col gap-1.5 p-4 rounded-xl border border-border bg-surface-canvas hover:border-brand-accent hover:shadow-md transition"
          >
            <span className="text-caption font-semibold uppercase tracking-wider text-brand-accent">
              {TYPE_LABEL[r.type]}
            </span>
            <span className="font-serif text-body font-medium text-ink-primary leading-snug group-hover:text-brand-accent transition-colors">
              {r.title}
            </span>
            {r.excerpt && (
              <span className="text-body-sm text-ink-secondary line-clamp-2">{r.excerpt}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
