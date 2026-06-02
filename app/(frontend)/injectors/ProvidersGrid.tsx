'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import type { ProviderListItem } from '@/lib/provider-queries'

const CREDENTIAL_LABELS: Record<string, string> = {
  MD: 'MD / DO',
  DO: 'MD / DO',
  NP: 'NP / PA',
  PA: 'NP / PA',
  RN: 'RN',
  DDS: 'DDS',
}

const CREDENTIAL_GROUPS = ['All', 'MD / DO', 'NP / PA', 'RN']

export function ProvidersGrid({ providers }: { providers: ProviderListItem[] }) {
  const [activeCredential, setActiveCredential] = useState('All')
  const [activeCity, setActiveCity] = useState('All')

  const cities = ['All', ...Array.from(new Set(providers.map((p) => p.clinic.city))).sort()]

  const filtered = providers.filter((p) => {
    const credGroup = CREDENTIAL_LABELS[p.credentials] || p.credentials
    const credMatch = activeCredential === 'All' || credGroup === activeCredential
    const cityMatch = activeCity === 'All' || p.clinic.city === activeCity
    return credMatch && cityMatch
  })

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center mb-8">
        <div className="flex gap-2 flex-wrap">
          <span className="text-caption text-ink-tertiary uppercase tracking-wider self-center mr-1">Credential</span>
          {CREDENTIAL_GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => setActiveCredential(g)}
              className={`px-4 py-2 rounded-pill text-body-sm font-medium border transition ${
                activeCredential === g
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'bg-surface-canvas text-ink-secondary border-border hover:border-brand-accent hover:text-ink-primary'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="w-px h-6 bg-border hidden md:block" />
        <div className="flex gap-2 flex-wrap">
          <span className="text-caption text-ink-tertiary uppercase tracking-wider self-center mr-1">City</span>
          {cities.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCity(c)}
              className={`px-4 py-2 rounded-pill text-body-sm font-medium border transition ${
                activeCity === c
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'bg-surface-canvas text-ink-secondary border-border hover:border-brand-accent hover:text-ink-primary'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-body-sm text-ink-tertiary mb-6">
        {filtered.length} {filtered.length === 1 ? 'injector' : 'injectors'} found
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-body text-ink-secondary">No injectors match your filters.</p>
          <button
            className="mt-4 text-brand-accent text-body-sm underline"
            onClick={() => { setActiveCredential('All'); setActiveCity('All') }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {filtered.map((p) => (
            <ProviderCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProviderCard({ p }: { p: ProviderListItem }) {
  const stars = Math.round(p.aggregateRating || 0)
  return (
    <article className="group card-premium bg-surface-canvas border border-border rounded-2xl overflow-hidden flex flex-col">
      {/* Clinic cover photo */}
      <div className="relative h-[180px] bg-surface overflow-hidden flex-shrink-0">
        {p.clinic.photoUrl ? (
          <Image
            src={p.clinic.photoUrl}
            alt={p.clinic.name}
            fill
            sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface to-brand-accent-soft" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        {p.editorsPick && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-brand-accent text-white text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-pill uppercase shadow">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
            </svg>
            Editor's pick
          </span>
        )}
        {p.acceptsNewPatients && (
          <span className="absolute top-3 right-3 bg-white/90 text-ink-primary text-[10px] font-semibold px-2.5 py-1 rounded-pill">
            Accepting new patients
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        {/* Avatar + name */}
        <div className="flex items-start gap-3 mb-4 -mt-9">
          <div className="relative w-14 h-14 rounded-pill overflow-hidden bg-surface flex-shrink-0 border-4 border-surface-canvas shadow-md">
            {p.profilePhotoUrl && (
              <Image src={p.profilePhotoUrl} alt={p.fullName} fill sizes="56px" className="object-cover" />
            )}
          </div>
          <div className="pt-9 flex-1 min-w-0">
            <div className="font-semibold text-body text-ink-primary leading-tight truncate">{p.fullName}</div>
            <div className="text-caption text-ink-secondary mt-0.5 line-clamp-1">{p.title}</div>
          </div>
        </div>

        {/* License badge */}
        <div className="flex items-center gap-2 mb-3 text-caption text-ink-secondary">
          <span className="inline-flex w-4 h-4 rounded-pill bg-brand-accent-soft items-center justify-center flex-shrink-0">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="3.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className="truncate">
            License verified &middot; {p.licenseStateCode} #{p.licenseNumber}
            {p.yearsExperience ? ` · ${p.yearsExperience} yrs` : ''}
          </span>
        </div>

        {/* Rating */}
        {p.aggregateRating ? (
          <div className="flex items-center gap-2 mb-3">
            <span className="star-row text-[13px]">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
            <span className="text-body-sm text-ink-secondary">
              {p.aggregateRating.toFixed(1)} ({p.aggregateRatingCount?.toLocaleString()})
            </span>
          </div>
        ) : null}

        {/* Treatment chips */}
        <div className="flex flex-wrap gap-1.5 mb-4 flex-1">
          {p.treatments.slice(0, 3).map((t) => (
            <span key={t} className="text-[11px] px-2.5 py-1 rounded-pill bg-brand-accent-soft text-brand-primary font-medium">
              {t}
            </span>
          ))}
          {p.treatments.length > 3 && (
            <span className="text-[11px] px-2.5 py-1 rounded-pill bg-surface text-ink-tertiary font-medium">
              +{p.treatments.length - 3} more
            </span>
          )}
        </div>

        {/* Price + location */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-border-subtle text-body-sm">
          {p.startingPrice ? (
            <div>
              <span className="text-ink-secondary">from </span>
              <span className="font-semibold text-ink-primary">${p.startingPrice}</span>
            </div>
          ) : (
            <div className="text-ink-tertiary">Pricing on request</div>
          )}
          <div className="text-ink-tertiary truncate ml-3">{p.clinic.neighborhood || p.clinic.city}, {p.clinic.state}</div>
        </div>

        {/* CTAs */}
        <div className="flex gap-2 mt-auto">
          <Link
            href={`/injectors/${p.slug}#book`}
            className="flex-1 bg-brand-primary text-white rounded-pill py-2.5 text-body-sm font-medium text-center hover:opacity-90 transition"
          >
            Book consult
          </Link>
          <Link
            href={`/injectors/${p.slug}`}
            className="flex-1 border border-border rounded-pill py-2.5 text-body-sm font-medium text-center text-ink-primary hover:bg-surface hover:border-brand-accent transition"
          >
            View profile
          </Link>
        </div>
      </div>
    </article>
  )
}
