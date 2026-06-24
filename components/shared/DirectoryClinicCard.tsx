'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { DirectoryClinic } from '@/lib/location-queries'
import { useSaved } from '@/components/account/SavedItemsProvider'

const CLINIC_TYPE_LABELS: Record<string, string> = {
  medspa: 'Med Spa',
  dermatology: 'Dermatology',
  'plastic-surgery': 'Plastic Surgery',
  'dental-aesthetics': 'Dental Aesthetics',
  other: 'Aesthetic Clinic',
}

export function DirectoryClinicCard({
  c,
  isSaved: isSavedProp,
  isHighlighted = false,
  dist = null,
  onSave: onSaveProp,
}: {
  c: DirectoryClinic
  isSaved?: boolean
  isHighlighted?: boolean
  dist?: number | null
  onSave?: () => void
}) {
  const { isSaved: isSavedFromHook, toggle } = useSaved()
  const isSaved = isSavedProp !== undefined ? isSavedProp : isSavedFromHook('clinic', c.id)
  const onSave = onSaveProp ?? (() => toggle('clinic', c.id))
  const stars = Math.round(c.aggregateRating || 0)
  const treatments = c.treatmentsOffered ?? []
  const visibleTreatments = treatments.slice(0, 3)
  const overflowCount = treatments.length - visibleTreatments.length
  const typeLabel = c.clinicType ? (CLINIC_TYPE_LABELS[c.clinicType] ?? 'Aesthetic Clinic') : undefined

  return (
    <article
      className={`group bg-surface-canvas rounded-2xl overflow-hidden flex flex-col border transition-all duration-200 hover:shadow-hover ${
        isHighlighted ? 'border-brand-accent shadow-hover' : 'border-border'
      }`}
    >
      {/* Photo */}
      <div className="relative h-[160px] bg-surface overflow-hidden flex-shrink-0">
        {c.photoUrl ? (
          <Image
            src={c.photoUrl}
            alt={c.clinicName}
            fill
            sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand-accent-soft to-surface" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

        {/* Save button */}
        <button
          onClick={(e) => { e.preventDefault(); onSave() }}
          className={`absolute top-3 right-3 w-8 h-8 rounded-pill flex items-center justify-center shadow-sm transition ${
            isSaved ? 'bg-brand-accent text-white' : 'bg-white/90 text-ink-secondary hover:bg-white'
          }`}
          title={isSaved ? 'Remove from saved' : 'Save clinic'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
        </button>

        {/* Type badge */}
        {typeLabel && (
          <div className="absolute bottom-3 left-3">
            <span className="bg-white/90 text-ink-primary text-[10px] font-semibold px-2.5 py-1 rounded-pill">
              {typeLabel}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        {/* Name + location */}
        <div>
          <h3 className="font-semibold text-body text-ink-primary leading-tight line-clamp-1">{c.clinicName}</h3>
          <p className="text-body-sm text-ink-secondary mt-0.5">
            {c.neighborhood ? `${c.neighborhood}, ` : ''}{c.city}, {c.state}
            {dist !== null && (
              <span className="ml-2 font-medium text-brand-accent">{dist.toFixed(1)} mi</span>
            )}
          </p>
        </div>

        {/* Rating */}
        {c.aggregateRating ? (
          <div className="flex items-center gap-1.5">
            <span className="star-row text-[12px] text-state-star">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
            <span className="text-caption text-ink-secondary">
              {c.aggregateRating.toFixed(1)}
              {c.aggregateRatingCount ? ` (${c.aggregateRatingCount.toLocaleString()})` : ''}
            </span>
          </div>
        ) : null}

        {/* Treatments chips */}
        {visibleTreatments.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visibleTreatments.map((t) => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-pill bg-brand-accent-soft text-brand-accent font-medium">
                {t}
              </span>
            ))}
            {overflowCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-pill bg-surface text-ink-tertiary font-medium">
                +{overflowCount}
              </span>
            )}
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-border-subtle">
          <div className="flex items-center gap-3 text-caption text-ink-tertiary">
            {c.providerCount > 0 && (
              <span>{c.providerCount} {c.providerCount === 1 ? 'provider' : 'providers'}</span>
            )}
            {c.startingPrice ? (
              <span>from <span className="text-ink-secondary font-medium">${c.startingPrice}</span></span>
            ) : null}
          </div>
          <Link
            href={`/clinics/${c.stateSlug}/${c.citySlug}/${c.slug}`}
            className="text-body-sm text-brand-accent font-medium hover:underline flex items-center gap-1"
          >
            View
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </Link>
        </div>
      </div>
    </article>
  )
}
