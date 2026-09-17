import type { Metadata } from 'next'
import { DEFAULT_OG_IMAGE } from '@/lib/seo-defaults'
import { getSiteConfig } from '@/lib/site-config-queries'

/**
 * One builder for a page's whole metadata object, so openGraph and twitter are
 * always complete and always identical. See docs/SEO-META-TAGS-PLAN-2026-09-17.md.
 *
 * Why a builder: in Next.js a page's `openGraph` replaces the layout's wholesale
 * (fields it omits, like type/url/siteName, vanish), and twitter tags are only
 * copied from openGraph when no segment set a twitter title, which the layout
 * does. Hand-written per-page metadata kept falling into both traps.
 */

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'injector.world'

/** Title suffix from the 2026-09-17 SEO sheet (directory and clinic templates). */
export const TITLE_SUFFIX = 'Find Your Injector at Injector.World'

export function withTitleSuffix(base: string): string {
  return `${base} | ${TITLE_SUFFIX}`
}

export type PageImage = { url: string; width?: number; height?: number }

export type PageMetadataInput = {
  /** Final <title>, used verbatim. Also og:title and twitter:title. */
  title: string
  description: string
  /** Absolute canonical url. Also og:url. Pass exactly what the page used before. */
  url: string
  /** The page's own image. Missing -> site default image (decision D7). */
  image?: PageImage | null
  /** og:image:alt and twitter:image:alt. */
  imageAlt: string
  /** Output of getPageRobots / getEntityRobots, spread as-is. */
  robots?: Record<string, unknown>
  /** Extra <link rel="alternate"> types, e.g. the news RSS feed. */
  alternateTypes?: Record<string, string>
  /** Present -> og:type "article" with these fields; absent -> og:type "website". */
  article?: { publishedTime?: string; modifiedTime?: string; authors?: string[] }
}

async function resolveImage(image: PageImage | null | undefined, alt: string) {
  if (image?.url) {
    return {
      url: image.url,
      ...(image.width ? { width: image.width } : {}),
      ...(image.height ? { height: image.height } : {}),
      alt,
    }
  }
  // Same fallback order the layout uses: admin Site Settings image first.
  // Its dimensions are unknown, so none are printed (decision D8).
  const { ogImageUrl } = await getSiteConfig()
  if (ogImageUrl) return { url: ogImageUrl, alt }
  return { ...DEFAULT_OG_IMAGE, alt }
}

export async function buildPageMetadata(input: PageMetadataInput): Promise<Metadata> {
  const { title, description, url, imageAlt, robots, alternateTypes, article } = input
  const image = await resolveImage(input.image, imageAlt)
  const og = {
    title,
    description,
    url,
    siteName: SITE_NAME,
    locale: 'en_US',
    images: [image],
  }

  return {
    title: { absolute: title },
    description,
    alternates: alternateTypes ? { canonical: url, types: alternateTypes } : { canonical: url },
    openGraph: article
      ? {
          ...og,
          type: 'article',
          publishedTime: article.publishedTime,
          modifiedTime: article.modifiedTime,
          authors: article.authors,
        }
      : { ...og, type: 'website' },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
    ...(robots ?? {}),
  }
}
