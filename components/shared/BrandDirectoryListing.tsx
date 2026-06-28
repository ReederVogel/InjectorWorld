'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ListingFilters } from './ListingFilters'
import { DirectoryClinicCard } from './DirectoryClinicCard'
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
              <DirectoryClinicCard key={c.id} c={c} />
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
