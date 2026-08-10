'use client'

import Image from 'next/image'
import { useCallback, useRef, useState } from 'react'
import { getYouTubeEmbedId } from '@/lib/youtube'

/** Keeps the dot row legible at the sidebar's ~340px width (see CLAUDE.md grid). */
const MAX_PHOTOS = 6

/**
 * Media slot above the clinic's booking form (client request 2026-08-11).
 * YouTube first: whichever clinics have a video get it embedded here. Every
 * other clinic falls back to a compact photo carousel sourced from the same
 * photoUrls the hero gallery uses. Renders nothing when a clinic has neither,
 * so the form card is untouched for it.
 *
 * No border, radius or shadow here on purpose: the parent clips this with
 * overflow-hidden and owns the one rounded-control frame the form sits inside
 * too, so video/photos and form read as a single attached card, not two.
 */
export function ClinicSidebarMedia({
  youtubeUrl,
  photoUrls,
  clinicName,
}: {
  youtubeUrl?: string
  photoUrls: string[]
  clinicName: string
}) {
  const embedId = getYouTubeEmbedId(youtubeUrl)

  if (embedId) {
    return (
      <div className="aspect-video w-full bg-ink-primary">
        <iframe
          src={`https://www.youtube.com/embed/${embedId}?rel=0&modestbranding=1`}
          title={`${clinicName} on YouTube`}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      </div>
    )
  }

  return <SidebarPhotoCarousel photoUrls={photoUrls} clinicName={clinicName} />
}

function SidebarPhotoCarousel({ photoUrls, clinicName }: { photoUrls: string[]; clinicName: string }) {
  const photos = photoUrls.slice(0, MAX_PHOTOS)
  const [active, setActive] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const step = useCallback(
    (delta: number) => setActive((current) => (current + delta + photos.length) % photos.length),
    [photos.length],
  )

  if (photos.length === 0) return null

  const multiple = photos.length > 1

  return (
    <div
      className="relative aspect-video w-full"
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current
        touchStartX.current = null
        if (start === null || !multiple) return
        const delta = (e.changedTouches[0]?.clientX ?? start) - start
        if (Math.abs(delta) < 40) return
        step(delta < 0 ? 1 : -1)
      }}
    >
      <Image
        src={photos[active]}
        alt={photos.length > 1 ? `${clinicName} photo ${active + 1} of ${photos.length}` : clinicName}
        fill
        sizes="340px"
        className="object-cover"
      />

      {multiple && (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface-canvas/90 text-ink-primary shadow-md transition hover:bg-surface-canvas"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface-canvas/90 text-ink-primary shadow-md transition hover:bg-surface-canvas"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {/* Dots overlay the frame's own bottom edge instead of sitting in a
              row underneath it: the media and the form have to touch with no
              gap, and a separate dot row would be exactly that gap. */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/50 to-transparent py-2.5">
            {photos.map((url, index) => (
              <button
                key={url}
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Show photo ${index + 1}`}
                aria-current={active === index}
                className={`h-1.5 rounded-full transition-all ${
                  active === index ? 'w-5 bg-white' : 'w-1.5 bg-white/60'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
