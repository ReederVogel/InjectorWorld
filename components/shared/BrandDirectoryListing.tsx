'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ListingFilters } from './ListingFilters'
import {
  DEFAULT_LISTING_FILTERS,
  applyListingFilters,
  type ListingFilterValues,
} from './applyListingFilters'

type FilterOption = { id: string; name: string }
import type { DirectoryClinic } from '@/lib/location-queries'

type Props = {
  clinics: DirectoryClinic[]
  serviceOptions?: FilterOption[]
  brandOptions?: FilterOption[]
  emptyMessage?: string
  emptyLink?: { href: string; label: string }
}

export function BrandDirectoryListing({
  clinics,
  serviceOptions,
  brandOptions,
  emptyMessage,
  emptyLink,
}: Props) {
  const [listingFilters, setListingFilters] = useState<ListingFilterValues>(DEFAULT_LISTING_FILTERS)

  const filtered = useMemo(
    () => applyListingFilters(clinics, listingFilters, 'clinic').items,
    [clinics, listingFilters],
  )

  return (
    <div className="md:flex md:items-start md:gap-6">
      <ListingFilters
        items={clinics}
        mode="clinics"
        resultCount={filtered.length}
        totalCount={clinics.length}
        onChange={setListingFilters}
        serviceOptions={serviceOptions}
        brandOptions={brandOptions}
      />

      <div className="min-w-0 flex-1">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {filtered.map((c) => (
              <Link
                key={c.id}
                href={`/clinics/${c.slug}`}
                className="group flex flex-col p-5 rounded-xl border border-border bg-surface hover:border-brand-accent hover:shadow-hover hover:-translate-y-[2px] transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-semibold text-body text-ink-primary group-hover:text-brand-accent transition leading-tight">
                    {c.clinicName}
                  </h3>
                  {c.aggregateRating && (
                    <span className="flex-shrink-0 flex items-center gap-1 text-caption font-semibold text-state-star">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      {c.aggregateRating.toFixed(1)}
                      {c.aggregateRatingCount && (
                        <span className="text-ink-tertiary font-normal">({c.aggregateRatingCount.toLocaleString()})</span>
                      )}
                    </span>
                  )}
                </div>
                <p className="text-body-sm text-ink-secondary mb-3">
                  {c.city}, {c.state}
                  {c.neighborhood && ` · ${c.neighborhood}`}
                </p>
                {c.tagline && (
                  <p className="text-body-sm text-ink-tertiary line-clamp-2 mb-3">{c.tagline}</p>
                )}
                <span className="mt-auto flex items-center gap-1.5 text-body-sm text-brand-accent font-medium">
                  View clinic
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-body text-ink-secondary mb-3">
              {emptyMessage ?? 'No clinics match the selected filters.'}
            </p>
            {emptyLink && (
              <Link href={emptyLink.href} className="text-brand-accent hover:underline text-body-sm">
                {emptyLink.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
