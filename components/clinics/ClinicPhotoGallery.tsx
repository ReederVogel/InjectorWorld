'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'

/**
 * Photos section for the clinic profile's left column.
 *
 * Was a plain server-rendered grid until 2026-08-06, which made the tiles read
 * as solid blocks: clicking did nothing and the "+N" counter was decoration.
 * Now every tile opens a lightbox, and "+N" opens it at the first photo that
 * did not fit in the grid. The lightbox holds all photos, not just the five on
 * screen.
 */
export function ClinicPhotoGallery({
  photoUrls,
  clinicName,
}: {
  photoUrls: string[]
  clinicName: string
}) {
  const [openAt, setOpenAt] = useState<number | null>(null)

  const tiles = photoUrls.slice(0, 5)
  const remaining = photoUrls.length - tiles.length

  const close = useCallback(() => setOpenAt(null), [])
  const step = useCallback(
    (delta: number) =>
      setOpenAt((current) =>
        current === null ? null : (current + delta + photoUrls.length) % photoUrls.length,
      ),
    [photoUrls.length],
  )

  useEffect(() => {
    if (openAt === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [openAt, close, step])

  if (photoUrls.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        {tiles.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOpenAt(i)}
            aria-label={`Open photo ${i + 1} of ${photoUrls.length}`}
            className="group relative aspect-[4/3] overflow-hidden rounded-control bg-surface"
          >
            <Image
              src={url}
              alt={`${clinicName} photo ${i + 1}`}
              fill
              sizes="(min-width:1024px) 220px, (min-width:640px) 30vw, 45vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </button>
        ))}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => setOpenAt(tiles.length)}
            aria-label={`Open the remaining ${remaining} photos`}
            className="flex aspect-[4/3] items-center justify-center rounded-control bg-surface text-body font-semibold text-ink-secondary transition hover:bg-surface-warm hover:text-ink-primary"
          >
            +{remaining}
          </button>
        )}
      </div>

      {openAt !== null && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${clinicName} photos`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close()
          }}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close photos"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {photoUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous photo"
                className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 md:left-6"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next photo"
                className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 md:right-6"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </>
          )}

          <figure className="flex max-h-full w-full max-w-4xl flex-col items-center gap-3">
            <div className="relative h-[70vh] w-full">
              <Image
                src={photoUrls[openAt]}
                alt={`${clinicName} photo ${openAt + 1}`}
                fill
                sizes="(min-width:1024px) 900px, 100vw"
                className="object-contain"
              />
            </div>
            <figcaption className="text-body-sm text-white/70">
              {openAt + 1} / {photoUrls.length}
            </figcaption>
          </figure>
        </div>
      )}
    </>
  )
}
