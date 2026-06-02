'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import type { ClinicListItem } from '@/lib/clinic-queries'

export function ClinicsGrid({ clinics }: { clinics: ClinicListItem[] }) {
  const [activeState, setActiveState] = useState('All')

  const states = ['All', ...Array.from(new Set(clinics.map((c) => c.state))).sort()]

  const filtered = clinics.filter(
    (c) => activeState === 'All' || c.state === activeState,
  )

  return (
    <div>
      {/* State filter */}
      <div className="flex flex-wrap gap-2 items-center mb-8">
        <span className="text-caption text-ink-tertiary uppercase tracking-wider self-center mr-1">State</span>
        {states.map((s) => (
          <button
            key={s}
            onClick={() => setActiveState(s)}
            className={`px-4 py-2 rounded-pill text-body-sm font-medium border transition ${
              activeState === s
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-surface-canvas text-ink-secondary border-border hover:border-brand-accent hover:text-ink-primary'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <p className="text-body-sm text-ink-tertiary mb-6">
        {filtered.length} {filtered.length === 1 ? 'clinic' : 'clinics'} found
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-body text-ink-secondary">No clinics match your filter.</p>
          <button className="mt-4 text-brand-accent text-body-sm underline" onClick={() => setActiveState('All')}>
            Clear filter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {filtered.map((c) => (
            <ClinicCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  )
}

function ClinicCard({ c }: { c: ClinicListItem }) {
  const stars = Math.round(c.aggregateRating || 0)
  return (
    <article className="group card-premium bg-surface-canvas border border-border rounded-2xl overflow-hidden flex flex-col">
      {/* Photo */}
      <div className="relative h-[200px] bg-surface overflow-hidden flex-shrink-0">
        {c.photoUrl ? (
          <Image
            src={c.photoUrl}
            alt={c.clinicName}
            fill
            sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface to-brand-accent-soft" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
        <div className="absolute bottom-3 left-3 flex gap-1.5">
          <span className="bg-white/90 text-ink-primary text-[10px] font-semibold px-2.5 py-1 rounded-pill">
            {c.serviceType}
          </span>
          {c.yearEstablished && (
            <span className="bg-white/90 text-ink-primary text-[10px] font-semibold px-2.5 py-1 rounded-pill">
              Est. {c.yearEstablished}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        <h2 className="font-semibold text-body text-ink-primary mb-1 leading-tight">{c.clinicName}</h2>
        <p className="text-body-sm text-ink-secondary mb-3">
          {c.neighborhood ? `${c.neighborhood}, ` : ''}{c.city}, {c.state}
        </p>

        {c.tagline && (
          <p className="text-body-sm text-ink-secondary mb-3 line-clamp-2 italic">{c.tagline}</p>
        )}

        {/* Rating */}
        {c.aggregateRating ? (
          <div className="flex items-center gap-2 mb-4">
            <span className="star-row text-[13px]">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
            <span className="text-body-sm text-ink-secondary">
              {c.aggregateRating.toFixed(1)} ({c.aggregateRatingCount?.toLocaleString()})
            </span>
          </div>
        ) : null}

        {/* Trust badge */}
        <div className="flex items-center gap-1.5 mb-4 text-caption text-ink-secondary flex-1">
          <span className="inline-flex w-4 h-4 rounded-pill bg-brand-accent-soft items-center justify-center flex-shrink-0">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="3.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          Verified practice
        </div>

        {/* Phone */}
        {c.phone && (
          <p className="text-body-sm text-ink-tertiary mb-4">{c.phone}</p>
        )}

        {/* CTA */}
        <Link
          href={`/clinics/${c.slug}`}
          className="mt-auto w-full bg-brand-primary text-white rounded-pill py-2.5 text-body-sm font-medium text-center hover:opacity-90 transition"
        >
          View clinic
        </Link>
      </div>
    </article>
  )
}
