import Image from 'next/image'

/**
 * Single 16:9 cover photo for the clinic hero.
 *
 * Replaced ClinicPhotoCarousel on 2026-08-06 (client request): the hero shows
 * one featured image and nothing else, because every other photo is now in the
 * Photos gallery further down the page, where they open in a lightbox.
 *
 * The empty state came across from the carousel unchanged.
 */
export function ClinicCoverPhoto({
  clinicName,
  photoUrls,
}: {
  clinicName: string
  photoUrls: string[]
}) {
  const cover = photoUrls[0]

  if (!cover) {
    return (
      <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface-warm via-surface to-brand-accent-soft">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-canvas text-brand-accent shadow-sm">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9h.01M9 12h.01M9 15h.01" />
            </svg>
          </div>
          <p className="text-body-sm font-semibold text-ink-primary">{clinicName}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-surface">
      <Image
        src={cover}
        alt={clinicName}
        fill
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="object-cover"
        priority
      />
    </div>
  )
}
