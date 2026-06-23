'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect } from 'react'
import type { ProviderListItem } from '@/lib/provider-queries'

export function CompareModal({
  providers,
  onClose,
}: {
  providers: ProviderListItem[]
  onClose: () => void
}) {
  // Trap focus + close on Escape
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

  const rows: Array<{ label: string; get: (p: ProviderListItem) => React.ReactNode }> = [
    {
      label: 'Rating',
      get: (p) =>
        p.aggregateRating ? (
          <div>
            <span className="font-semibold text-body text-ink-primary">{p.aggregateRating.toFixed(1)}</span>
            <span className="star-row text-[12px] ml-1.5">{'★'.repeat(Math.round(p.aggregateRating))}</span>
            <div className="text-caption text-ink-tertiary">{p.aggregateRatingCount?.toLocaleString()} reviews</div>
          </div>
        ) : (
          <span className="text-ink-tertiary text-body-sm">No reviews yet</span>
        ),
    },
    {
      label: 'Credential',
      get: (p) => (
        <div>
          <span className="font-semibold text-ink-primary">{p.credentials}</span>
          <div className="text-caption text-ink-secondary line-clamp-2">{p.title}</div>
        </div>
      ),
    },
    {
      label: 'Starting price',
      get: (p) =>
        p.startingPrice ? (
          <span className="font-semibold text-ink-primary">${p.startingPrice}</span>
        ) : (
          <span className="text-ink-tertiary text-body-sm">On request</span>
        ),
    },
    {
      label: 'Treatments',
      get: (p) => (
        <div className="flex flex-wrap gap-1">
          {p.treatments.slice(0, 4).map((t) => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-pill bg-brand-accent-soft text-brand-primary font-medium">
              {t}
            </span>
          ))}
          {p.treatments.length > 4 && (
            <span className="text-[10px] px-2 py-0.5 rounded-pill bg-surface text-ink-tertiary font-medium">
              +{p.treatments.length - 4}
            </span>
          )}
        </div>
      ),
    },
    {
      label: 'License',
      get: (p) => (
        <div className="flex items-start gap-1.5">
          <span className="inline-flex w-3.5 h-3.5 rounded-full bg-brand-accent-soft items-center justify-center mt-0.5 flex-shrink-0">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="3.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className="text-body-sm text-ink-secondary">
            {p.licenseStateCode} #{p.licenseNumber}
          </span>
        </div>
      ),
    },
    {
      label: 'Location',
      get: (p) => (
        <div className="text-body-sm text-ink-secondary">
          <div className="font-medium text-ink-primary line-clamp-1">{p.clinic.name}</div>
          <div>{p.clinic.neighborhood || p.clinic.city}, {p.clinic.state}</div>
        </div>
      ),
    },
    {
      label: 'Experience',
      get: (p) =>
        p.yearsExperience ? (
          <span className="text-body-sm text-ink-primary font-medium">{p.yearsExperience} years</span>
        ) : (
          <span className="text-ink-tertiary text-body-sm">Not listed</span>
        ),
    },
    {
      label: 'New patients',
      get: (p) =>
        p.acceptsNewPatients ? (
          <span className="inline-flex items-center gap-1 text-body-sm text-brand-accent font-medium">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            Accepting
          </span>
        ) : (
          <span className="text-body-sm text-ink-tertiary">Waitlist</span>
        ),
    },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Compare injectors"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-surface-canvas rounded-2xl shadow-lg w-full max-w-5xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface-canvas border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-serif text-h3 text-ink-primary">Side-by-side comparison</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-pill flex items-center justify-center border border-border hover:bg-surface transition text-ink-secondary"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            {/* Provider headers */}
            <thead>
              <tr>
                <th className="w-28 p-4 sticky left-0 z-10 bg-surface-canvas" />
                {providers.map((p) => (
                  <th key={p.id} className="p-4 text-left border-l border-border-subtle">
                    <div className="flex items-start gap-3">
                      <div className="relative w-12 h-12 rounded-pill overflow-hidden bg-surface flex-shrink-0">
                        {p.profilePhotoUrl && (
                          <Image src={p.profilePhotoUrl} alt={p.fullName} fill sizes="48px" className="object-cover" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-body-sm text-ink-primary leading-tight">{p.fullName}</div>
                        <div className="text-caption text-ink-tertiary">{p.credentials}</div>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Rows */}
            <tbody>
              {rows.map(({ label, get }) => (
                <tr key={label} className="border-t border-border-subtle">
                  <td className="p-4 text-caption font-semibold text-ink-tertiary uppercase tracking-wider bg-surface sticky left-0 z-10 border-r border-border">
                    {label}
                  </td>
                  {providers.map((p) => (
                    <td key={p.id} className="p-4 border-l border-border-subtle align-top">
                      {get(p)}
                    </td>
                  ))}
                </tr>
              ))}

              {/* CTA row */}
              <tr className="border-t border-border-subtle">
                <td className="p-4 bg-surface sticky left-0 z-10 border-r border-border" />
                {providers.map((p) => (
                  <td key={p.id} className="p-4 border-l border-border-subtle">
                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/injectors/${p.clinic.stateSlug}/${p.clinic.citySlug}/${p.slug}#book`}
                        className="w-full bg-brand-primary text-surface-canvas rounded-pill py-2 text-body-sm font-medium text-center hover:opacity-90 transition"
                      >
                        Book consult
                      </Link>
                      <Link
                        href={`/injectors/${p.clinic.stateSlug}/${p.clinic.citySlug}/${p.slug}`}
                        className="w-full border border-border rounded-pill py-2 text-body-sm font-medium text-center text-ink-primary hover:bg-surface hover:border-brand-accent transition"
                      >
                        View profile
                      </Link>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
