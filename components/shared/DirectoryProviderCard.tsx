import Image from 'next/image'
import Link from 'next/link'
import type { DirectoryProvider } from '@/lib/location-queries'
import { licenseClaim } from '@/lib/license'

const LOYALTY_LABELS: Record<string, string> = {
  alle: 'Allē',
  aspire: 'Aspire',
  xperience: 'Xperience',
  other: 'Loyalty',
}

export function DirectoryProviderCard({ provider, index = 0 }: { provider: DirectoryProvider; index?: number }) {
  const stars = Math.round(provider.aggregateRating || 0)
  const tags = provider.treatments.slice(0, 3)

  return (
    <article className="group bg-surface-canvas border border-border rounded-xl p-4 md:p-5 hover:border-brand-accent hover:shadow-md transition-all duration-200 relative">
      {provider.editorsPick && (
        <span className="absolute -top-2.5 left-4 bg-brand-accent text-white text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded-pill uppercase shadow-sm">
          Top pick
        </span>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className="relative flex-shrink-0 w-14 h-14 rounded-full overflow-hidden bg-surface border border-border">
          {provider.profilePhotoUrl ? (
            <Image src={provider.profilePhotoUrl} alt={provider.fullName} fill sizes="56px" className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ink-tertiary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-body-sm text-ink-primary leading-tight truncate">{provider.fullName}</div>
          <div className="text-caption text-ink-secondary mt-0.5 leading-snug truncate">{provider.title}</div>
          {provider.aggregateRating ? (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="star-row text-[11px]">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
              <span className="text-caption text-ink-tertiary">
                {provider.aggregateRating.toFixed(1)} ({provider.aggregateRatingCount?.toLocaleString()})
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Location — prominent so multi-clinic providers are unambiguous */}
      <div className="flex items-center gap-1.5 mb-2 text-caption font-medium text-ink-secondary">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-tertiary flex-shrink-0">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
        <span className="truncate">
          {provider.clinic.neighborhood ? `${provider.clinic.neighborhood}, ` : ''}{provider.clinic.city}, {provider.clinic.state}
        </span>
        {provider.additionalLocationCount > 0 && (
          <span className="flex-shrink-0 text-ink-tertiary">+{provider.additionalLocationCount}</span>
        )}
      </div>

      <div className="flex items-center gap-1.5 mb-3 text-caption text-ink-secondary">
        <span className="inline-flex w-4 h-4 rounded-full bg-brand-accent-soft items-center justify-center flex-shrink-0">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <span className="truncate">{licenseClaim(provider.licenseVerificationUrl)} &middot; {provider.licenseStateCode} #{provider.licenseNumber}</span>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((t) => (
            <span key={t} className="text-[10px] px-2.5 py-1 rounded-pill bg-brand-accent-soft text-brand-primary font-medium">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Loyalty program badges */}
      {provider.loyaltyPrograms && provider.loyaltyPrograms.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {provider.loyaltyPrograms.map((p) => (
            <span
              key={p}
              className="text-[9px] px-2 py-0.5 rounded-pill bg-surface border border-border text-ink-tertiary font-medium uppercase tracking-wide"
            >
              {LOYALTY_LABELS[p] ?? p}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-caption mb-3 pb-3 border-b border-border-subtle">
        {provider.startingPrice ? (
          <span>
            <span className="text-ink-tertiary">from </span>
            <span className="font-semibold text-ink-primary">${provider.startingPrice}</span>
          </span>
        ) : <span className="text-ink-tertiary">On request</span>}
      </div>

      <div className="flex gap-2">
        <Link
          href={`/injectors/${provider.slug}#book`}
          className="flex-1 bg-brand-primary text-surface-canvas rounded-pill py-2 text-caption font-medium text-center hover:opacity-90 transition"
        >
          Book consult
        </Link>
        <Link
          href={`/injectors/${provider.slug}`}
          className="flex-1 border border-border rounded-pill py-2 text-caption font-medium text-center text-ink-primary hover:bg-surface transition"
        >
          View profile
        </Link>
      </div>
    </article>
  )
}
