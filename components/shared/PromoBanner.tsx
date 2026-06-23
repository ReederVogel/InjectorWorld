import Image from 'next/image'
import type { ActiveBanner } from '@/lib/promotions'

type Props = { banner: ActiveBanner | null }

export function PromoBanner({ banner }: Props) {
  if (!banner || !banner.bannerLinkUrl) return null

  return (
    <div className="w-full bg-surface-canvas border-b border-border">
      <div className="max-canvas py-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="inline-block text-[10px] font-semibold tracking-widest uppercase text-ink-tertiary border border-border-subtle rounded px-1.5 py-0.5 leading-none">
            Ad
          </span>
        </div>
        <a
          href={banner.bannerLinkUrl}
          target="_blank"
          rel="sponsored noopener noreferrer"
          aria-label={banner.bannerAltText || 'Advertisement'}
          className="block rounded-xl overflow-hidden border border-border hover:border-brand-accent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
        >
          {banner.bannerImageUrl ? (
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
          ) : (
            <div className="w-full bg-surface-warm flex items-center justify-center py-5 px-6 min-h-[60px]">
              <span className="font-semibold text-body text-ink-primary">Advertisement</span>
            </div>
          )}
        </a>
      </div>
    </div>
  )
}
