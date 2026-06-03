import Image from 'next/image'
import Link from 'next/link'
import type { SponsoredProvider } from '@/lib/promotion-queries'

export function SponsoredProviderCard({ provider }: { provider: SponsoredProvider }) {
  const stars = Math.round(provider.aggregateRating || 0)
  const tags = provider.treatments.slice(0, 3)

  return (
    <article className="relative bg-surface border border-border rounded-xl p-4 md:p-5 transition-all">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-semibold tracking-widest text-ink-tertiary uppercase border border-border-subtle rounded px-1.5 py-0.5">
          Sponsored
        </span>
      </div>

      <div className="flex items-start gap-3 mb-3">
        <div className="relative flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-surface-canvas border border-border">
          {provider.profilePhotoUrl ? (
            <Image src={provider.profilePhotoUrl} alt={provider.fullName} fill sizes="48px" className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ink-tertiary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-body-sm text-ink-primary leading-tight truncate">{provider.fullName}</div>
          <div className="text-caption text-ink-secondary mt-0.5 truncate">{provider.title}</div>
          {provider.aggregateRating ? (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="star-row text-[11px]">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
              <span className="text-caption text-ink-tertiary">{provider.aggregateRating.toFixed(1)}</span>
            </div>
          ) : null}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((t) => (
            <span key={t} className="text-[10px] px-2.5 py-1 rounded-pill bg-surface-canvas text-ink-secondary border border-border font-medium">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <Link
          href={`/injectors/${provider.slug}#book`}
          className="flex-1 bg-brand-primary text-white rounded-pill py-2 text-caption font-medium text-center hover:opacity-90 transition"
        >
          Book consult
        </Link>
        <Link
          href={`/injectors/${provider.slug}`}
          className="flex-1 border border-border rounded-pill py-2 text-caption font-medium text-center text-ink-primary hover:bg-surface-canvas transition"
        >
          View profile
        </Link>
      </div>
    </article>
  )
}
