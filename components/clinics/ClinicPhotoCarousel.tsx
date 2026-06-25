'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'

export function ClinicPhotoCarousel({
  clinicName,
  photoUrls,
}: {
  clinicName: string
  photoUrls: string[]
}) {
  const photos = useMemo(() => photoUrls.slice(0, 5), [photoUrls])
  const [active, setActive] = useState(0)

  if (photos.length === 0) {
    return (
      <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface-warm via-surface to-brand-accent-soft">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-pill bg-surface-canvas text-brand-accent shadow-sm">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9h.01M9 12h.01M9 15h.01" />
            </svg>
          </div>
          <p className="text-body-sm font-semibold text-ink-primary">{clinicName}</p>
        </div>
      </div>
    )
  }

  function showPrevious() {
    setActive((current) => (current === 0 ? photos.length - 1 : current - 1))
  }

  function showNext() {
    setActive((current) => (current === photos.length - 1 ? 0 : current + 1))
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex snap-x snap-mandatory overflow-x-auto md:overflow-hidden">
        {photos.map((url, index) => (
          <div
            key={url}
            className="relative aspect-video w-full shrink-0 snap-center"
            style={{ transform: `translateX(-${active * 100}%)` }}
          >
            <Image
              src={url}
              alt={`${clinicName} photo ${index + 1}`}
              fill
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="object-cover"
              priority={index === 0}
            />
          </div>
        ))}
      </div>

      {photos.length > 1 && (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-24 bg-gradient-to-r from-black/20 to-transparent md:block" />
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-24 bg-gradient-to-l from-black/20 to-transparent md:block" />
          <button
            type="button"
            onClick={showPrevious}
            className="absolute left-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-pill bg-white/90 text-ink-primary shadow-md transition hover:bg-white md:flex"
            aria-label="Previous clinic photo"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={showNext}
            className="absolute right-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-pill bg-white/90 text-ink-primary shadow-md transition hover:bg-white md:flex"
            aria-label="Next clinic photo"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {photos.map((url, index) => (
              <button
                key={url}
                type="button"
                onClick={() => setActive(index)}
                className={`h-2 rounded-pill transition-all ${
                  active === index ? 'w-6 bg-white' : 'w-2 bg-white/60'
                }`}
                aria-label={`Show clinic photo ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
