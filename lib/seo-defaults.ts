import type { Metadata } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

// Sitewide fallback social share image. Square logo mark, not a designed
// 1200x630 banner -- swap for a proper OG banner when one exists.
// Black mark on solid white (not transparent) so it stays visible regardless
// of what background color the sharing platform's preview card uses.
export const DEFAULT_OG_IMAGE = { url: `${siteUrl}/og-image.png`, width: 1254, height: 1254 }

export const DEFAULT_OG_IMAGES: NonNullable<NonNullable<Metadata['openGraph']>['images']> = [
  { ...DEFAULT_OG_IMAGE, alt: 'injector.world' },
]
