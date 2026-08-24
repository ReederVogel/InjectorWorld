'use client'

import { useState } from 'react'
import { DirectoryClinicCard } from './DirectoryClinicCard'
import type { DirectoryClinic } from '@/lib/location-queries'
import { useSaved } from '@/components/account/SavedItemsProvider'

const PAGE = 12

/**
 * Generic, paginated clinic result list. Used by the state hub and /search.
 * Clinics arrive already merit-ordered from the server; this component only
 * handles the "Load more" window and saved-clinic state.
 *
 * Renamed from ProviderClinicResults on 2026-08-24, when the Providers
 * collection was removed and the provider tab lost its data source.
 */
export function ClinicResults({ clinics }: { clinics: DirectoryClinic[] }) {
  const [visible, setVisible] = useState(PAGE)
  const { isSaved, toggle } = useSaved()
  // Sign-up gate removed 2026-08-06 (client request). "Load more" is
  // pagination, not a wall.

  if (clinics.length === 0) {
    return <p className="text-body text-ink-secondary py-8">No clinics found yet.</p>
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {clinics.slice(0, visible).map((c) => (
          <DirectoryClinicCard
            key={c.id}
            c={c}
            isSaved={isSaved('clinic', c.id)}
            isHighlighted={false}
            dist={null}
            onSave={() => toggle('clinic', c.id)}
          />
        ))}
      </div>
      {visible < clinics.length && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-body-sm text-ink-tertiary">
            Showing {Math.min(visible, clinics.length)} of {clinics.length}
          </p>
          <button
            onClick={() => setVisible((c) => c + PAGE)}
            className="px-6 py-3 rounded-control border border-border bg-surface-canvas text-body-sm font-semibold text-ink-primary hover:border-brand-accent hover:bg-surface transition"
          >
            Load more clinics
          </button>
        </div>
      )}
    </div>
  )
}
