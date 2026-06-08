import Image from 'next/image'
import Link from 'next/link'
import type { DirectoryClinic } from '@/lib/location-queries'

export function DirectoryClinicCard({
  c,
  isSaved,
  isHighlighted,
  dist,
  onSave,
}: {
  c: DirectoryClinic
  isSaved: boolean
  isHighlighted: boolean
  dist: number | null
  onSave: () => void
}) {
  const stars = Math.round(c.aggregateRating || 0)
  return (
    <article
      className={`group card-premium bg-surface-canvas rounded-2xl overflow-hidden flex flex-col border-2 transition-all duration-200 ${
        isHighlighted ? 'border-brand-accent shadow-hover scale-[1.01]' : 'border-border'
      }`}
    >
      {/* Photo */}
      <div className="relative h-[180px] bg-surface overflow-hidden flex-shrink-0">
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

        {/* Save button */}
        <button
          onClick={(e) => { e.preventDefault(); onSave() }}
          className={`absolute top-3 right-3 w-8 h-8 rounded-pill flex items-center justify-center shadow transition ${
            isSaved ? 'bg-brand-accent text-white' : 'bg-white/90 text-ink-secondary hover:bg-white'
          }`}
          title={isSaved ? 'Remove from saved' : 'Save clinic'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
        </button>

        {/* Badges */}
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
        <h3 className="font-semibold text-body text-ink-primary mb-1 leading-tight">{c.clinicName}</h3>
        <p className="text-body-sm text-ink-secondary mb-2">
          {c.neighborhood ? `${c.neighborhood}, ` : ''}{c.city}, {c.state}
          {dist !== null && (
            <span className="ml-2 font-medium text-brand-accent">{dist.toFixed(1)} mi</span>
          )}
        </p>

        {c.tagline && (
          <p className="text-body-sm text-ink-secondary mb-3 line-clamp-2 italic">{c.tagline}</p>
        )}

        {c.aggregateRating ? (
          <div className="flex items-center gap-2 mb-3">
            <span className="star-row text-[13px]">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
            <span className="text-body-sm text-ink-secondary">
              {c.aggregateRating.toFixed(1)} ({c.aggregateRatingCount?.toLocaleString()})
            </span>
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 mb-4 text-caption text-ink-secondary flex-1">
          <span className="inline-flex w-4 h-4 rounded-full bg-brand-accent-soft items-center justify-center flex-shrink-0">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="3.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          {c.providerCount} {c.providerCount === 1 ? 'provider' : 'providers'} here
        </div>

        <Link
          href={`/clinics/${c.slug}`}
          className="mt-auto w-full bg-brand-primary text-surface-canvas rounded-pill py-2.5 text-body-sm font-medium text-center hover:opacity-90 transition"
        >
          View clinic
        </Link>
      </div>
    </article>
  )
}
