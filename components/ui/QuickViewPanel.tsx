'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect } from 'react'
import type { ProviderListItem } from '@/lib/provider-queries'

function availabilityDot(p: ProviderListItem) {
  if (!p.acceptsNewPatients) return { color: 'bg-ink-tertiary', label: 'Waitlist' }
  if ((p.aggregateRatingCount ?? 0) >= 350) return { color: 'bg-yellow-400', label: 'In demand' }
  return { color: 'bg-brand-accent', label: 'Available' }
}

export function QuickViewPanel({
  provider,
  onClose,
}: {
  provider: ProviderListItem
  onClose: () => void
}) {
  const stars = Math.round(provider.aggregateRating || 0)
  const avail = availabilityDot(provider)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-end md:justify-center p-0 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Quick view: ${provider.fullName}`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet: slides up on mobile, slides in from right on desktop */}
      <div className="relative bg-surface-canvas rounded-t-2xl md:rounded-2xl shadow-lg w-full md:w-[440px] max-h-[90vh] overflow-auto animate-fade-up md:animate-none">
        {/* Close */}
        <div className="sticky top-0 bg-surface-canvas/90 backdrop-blur-sm px-5 py-3 flex items-center justify-between border-b border-border z-10">
          <span className="text-caption text-ink-tertiary uppercase tracking-wider font-semibold">Quick view</span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-pill flex items-center justify-center border border-border hover:bg-surface transition text-ink-secondary"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {/* Cover + avatar */}
          {provider.clinic.photoUrl && (
            <div className="relative h-[160px] rounded-xl overflow-hidden mb-4 bg-surface">
              <Image
                src={provider.clinic.photoUrl}
                alt={provider.clinic.name}
                fill
                sizes="440px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>
          )}

          {/* Identity */}
          <div className="flex items-start gap-3 mb-4">
            <div className="relative w-16 h-16 rounded-pill overflow-hidden bg-surface flex-shrink-0 border-2 border-border shadow-sm">
              {provider.profilePhotoUrl && (
                <Image src={provider.profilePhotoUrl} alt={provider.fullName} fill sizes="64px" className="object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-body text-ink-primary leading-tight">{provider.fullName}</h3>
                <span className={`inline-block w-2 h-2 rounded-full ${avail.color}`} title={avail.label} />
                <span className="text-caption text-ink-secondary">{avail.label}</span>
              </div>
              <p className="text-body-sm text-ink-secondary mt-0.5 line-clamp-1">{provider.title}</p>
            </div>
          </div>

          {/* License badge */}
          <div className="flex items-center gap-2 mb-3 text-caption text-ink-secondary">
            <span className="inline-flex w-4 h-4 rounded-pill bg-brand-accent-soft items-center justify-center flex-shrink-0">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="3.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            License verified &middot; {provider.licenseStateCode} #{provider.licenseNumber}
            {provider.yearsExperience ? ` · ${provider.yearsExperience} yrs exp` : ''}
          </div>

          {/* Rating */}
          {provider.aggregateRating && (
            <div className="flex items-center gap-2 mb-4">
              <span className="star-row text-[14px]">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
              <span className="font-semibold text-body-sm text-ink-primary">{provider.aggregateRating.toFixed(1)}</span>
              <span className="text-body-sm text-ink-secondary">({provider.aggregateRatingCount?.toLocaleString()})</span>
            </div>
          )}

          {/* Treatments */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {provider.treatments.map((t) => (
              <span key={t} className="text-[11px] px-2.5 py-1 rounded-pill bg-brand-accent-soft text-brand-primary font-medium">
                {t}
              </span>
            ))}
          </div>

          {/* Price + location */}
          <div className="flex items-center justify-between py-3 border-y border-border-subtle mb-4 text-body-sm">
            {provider.startingPrice ? (
              <div><span className="text-ink-secondary">from </span><span className="font-semibold text-ink-primary">${provider.startingPrice}</span></div>
            ) : (
              <span className="text-ink-tertiary">Pricing on request</span>
            )}
            <div className="text-ink-tertiary">
              {provider.clinic.neighborhood || provider.clinic.city}, {provider.clinic.state}
            </div>
          </div>

          {/* CTAs */}
          <div className="flex gap-2">
            <Link
              href={`/injectors/${provider.clinic.citySlug}/${provider.slug}#book`}
              onClick={onClose}
              className="flex-1 bg-brand-primary text-surface-canvas rounded-pill py-3 text-body-sm font-semibold text-center hover:opacity-90 transition"
            >
              Book consult
            </Link>
            <Link
              href={`/injectors/${provider.clinic.citySlug}/${provider.slug}`}
              onClick={onClose}
              className="flex-1 border border-border rounded-pill py-3 text-body-sm font-medium text-center text-ink-primary hover:bg-surface hover:border-brand-accent transition"
            >
              Full profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
