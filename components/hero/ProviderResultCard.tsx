'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { HeroProviderCard } from '@/lib/hero-queries'
import { licenseClaim } from '@/lib/license'

export function ProviderResultCard({
  provider,
  active,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  index,
}: {
  provider: HeroProviderCard
  active?: boolean
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onFocus?: () => void
  index: number
}) {
  const stars = Math.round(provider.aggregateRating || 0)
  const tags = provider.treatments.slice(0, 3)

  return (
    <article
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
      className={`group relative bg-surface-canvas border rounded-lg p-4 md:p-5 transition-all duration-200 animate-fade-up ${
        active
          ? 'border-brand-accent shadow-hover -translate-y-0.5'
          : 'border-border hover:border-brand-accent hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      {provider.editorsPick && (
        <span className="absolute -top-2 left-4 bg-brand-accent text-surface-canvas text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded-pill uppercase shadow-sm">
          Editor's pick
        </span>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className="relative flex-shrink-0 w-14 h-14 rounded-pill overflow-hidden bg-surface">
          {provider.profilePhotoUrl && (
            <Image
              src={provider.profilePhotoUrl}
              alt={provider.fullName}
              fill
              className="object-cover"
              sizes="56px"
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-body-sm text-ink-primary leading-tight">{provider.fullName}</div>
          <div className="text-caption text-ink-secondary mt-0.5 leading-snug">{provider.title}</div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="flex text-state-star text-[11px] tracking-[1px]">
              {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
            </span>
            <span className="text-caption text-ink-tertiary">
              {provider.aggregateRating?.toFixed(1)} ({provider.aggregateRatingCount})
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-3 text-caption text-ink-secondary">
        <span className="inline-flex w-4 h-4 rounded-pill bg-brand-accent-soft items-center justify-center flex-shrink-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <span className="truncate">{licenseClaim(provider.licenseVerificationUrl)} &middot; {provider.licenseStateCode} #{provider.licenseNumber}</span>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((t) => (
            <span
              key={t}
              className="text-[11px] px-2.5 py-1 rounded-pill bg-brand-accent-soft text-brand-primary font-medium"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-caption pb-3 mb-3 border-b border-border-subtle">
        <div className="text-ink-primary">
          <span className="text-ink-tertiary">from </span>
          <span className="font-semibold">${provider.startingPrice}</span>
        </div>
        <div className="flex items-center gap-1 text-ink-tertiary truncate ml-2">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          <span className="truncate">{provider.clinic.neighborhood ? `${provider.clinic.neighborhood}, ` : ''}{provider.clinic.city}, {provider.clinic.state}</span>
        </div>
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
