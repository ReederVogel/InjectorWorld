import Image from 'next/image'
import type { ActiveBanner } from '@/lib/promotion-queries'

type Props = { banner: ActiveBanner | null }

/**
 * AdBanner — renders the active ad banner for a listing page scope.
 *
 * Renders nothing when banner is null (no banner configured for this scope).
 * FTC-required "Ad" / "Sponsored" disclosure label is always visible.
 * Link opens in a new tab with rel="sponsored noopener noreferrer".
 *
 * Dark-mode safe: uses design tokens only. Mobile-first.
 */
export function AdBanner({ banner }: Props) {
  if (!banner) return null

  const label = banner.advertiserName ? `Ad · ${banner.advertiserName}` : 'Ad'
  const ariaLabel = banner.bannerAltText
    || (banner.advertiserName ? `Advertisement by ${banner.advertiserName}` : 'Advertisement')

  return (
    <div className="w-full bg-surface-canvas border-b border-border">
      <div className="max-canvas py-2.5">
        {/* FTC disclosure label — always above the banner creative */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="inline-block text-[10px] font-semibold tracking-widest uppercase text-ink-tertiary border border-border-subtle rounded px-1.5 py-0.5 leading-none">
            {label}
          </span>
        </div>

        {/* Banner creative */}
        {banner.bannerLinkUrl ? (
          <a
            href={banner.bannerLinkUrl}
            target="_blank"
            rel="sponsored noopener noreferrer"
            aria-label={ariaLabel}
            className="block rounded-xl overflow-hidden border border-border hover:border-brand-accent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          >
            <BannerCreative banner={banner} />
          </a>
        ) : (
          <div className="rounded-xl overflow-hidden border border-border">
            <BannerCreative banner={banner} />
          </div>
        )}
      </div>
    </div>
  )
}

function BannerCreative({ banner }: { banner: ActiveBanner }) {
  if (banner.bannerImageUrl) {
    return (
      /* 6:1 aspect ratio (1200x200) on desktop, capped at 160px tall on mobile */
      <div
        className="relative w-full bg-surface"
        style={{ aspectRatio: '6 / 1', maxHeight: '160px', minHeight: '60px' }}
      >
        <Image
          src={banner.bannerImageUrl}
          alt={banner.bannerAltText || 'Advertisement'}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 1280px"
          priority={false}
        />
      </div>
    )
  }

  /* Text-only fallback when no image URL is set */
  return (
    <div className="w-full bg-surface-warm flex items-center justify-center py-5 px-6 min-h-[60px]">
      <span className="font-semibold text-body text-ink-primary">
        {banner.advertiserName || 'Advertisement'}
      </span>
    </div>
  )
}
