import type { Metadata } from 'next'
import Script from 'next/script'
import { Playfair_Display, Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import { SessionProvider } from '@/components/account/SessionContext'
import { SavedItemsProvider } from '@/components/account/SavedItemsProvider'
import { ScrollProgress } from '@/components/ui/ScrollProgress'
import { AssistantWidget } from '@/components/assistant/AssistantWidget'
import { AnalyticsBeacon } from '@/components/analytics/AnalyticsBeacon'
import { DEFAULT_OG_IMAGES } from '@/lib/seo-defaults'
import { getSiteConfig } from '@/lib/site-config-queries'
import { NOINDEX_ROBOTS } from '@/lib/markets'
import '../globals.css'

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
})

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
  weight: ['400', '500', '600', '700'],
})

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'injector.world'
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

// Fallback link-preview copy, kept in sync with the homepage hero
// (components/hero/Hero.tsx). Editable without a deploy via admin ->
// Site Settings -> Link preview title/description/image; these are only
// the defaults used when those fields are left blank.
const DEFAULT_META_TITLE = `${siteName} — Find Your Injector.`
const DEFAULT_META_DESCRIPTION = 'Every Treatment. Every Brand. Every Injectable. Right Here. Right Now.'

export async function generateMetadata(): Promise<Metadata> {
  const { metaTitle, metaDescription, ogImageUrl, siteNoindex } = await getSiteConfig()
  const title = metaTitle || DEFAULT_META_TITLE
  const description = metaDescription || DEFAULT_META_DESCRIPTION
  const images = ogImageUrl ? [{ url: ogImageUrl, alt: siteName }] : DEFAULT_OG_IMAGES

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: `%s | ${siteName}`,
    },
    description,
    openGraph: { type: 'website', title, description, siteName, url: siteUrl, images },
    twitter: { card: 'summary_large_image', title, description, images },
    // Sitewide pre-launch switch (admin -> Site Settings). It lives here as a
    // metadata key, not as a separate <meta> tag, so a page can only ever carry
    // ONE robots tag: Next.js replaces this key when a page returns its own
    // `robots` (page not batched in on /admin/indexing, or an auth page), and
    // inherits it when the page returns none. See
    // docs/SEO-META-TAGS-PLAN-2026-09-17.md.
    ...(siteNoindex ? { robots: NOINDEX_ROBOTS } : {}),
  }
}

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  const { chatWidgetEnabled } = await getSiteConfig()
  return (
    <html lang="en-US" prefix="og: https://ogp.me/ns#" suppressHydrationWarning className={`${inter.variable} ${playfairDisplay.variable}`}>
      <head>
        {/* lazyOnload, not afterInteractive. Neither blocks first render, but
            afterInteractive starts the fetch during hydration, and GTM pulls
            286KB in two hops (gtm.js 127KB, which then loads gtag 159KB) that
            compete with the page's own JS for bandwidth and main-thread time.
            Measured on staging 2026-09-05: mobile TBT averaged 344ms across 30
            pages. lazyOnload waits for the window load event instead.
            Trade-off: a visitor who leaves within about a second of load may not
            be counted. Nothing on the site reads from GTM, so no feature depends
            on when it arrives.

            2026-09-24: and after load, it waits for the first scroll, click,
            key or touch, or 4 seconds, whichever comes first. Even on load, GTM
            and gtag still ran inside Lighthouse's measurement window (~650ms of
            main thread, 130KB unused JS on every page). Founder accepted the
            trade-off: a visitor who leaves within 4 seconds without touching
            the page is not counted. docs/PAGE-SPEED-PLAN-2026-09-24.md TASK 4. */}
        {GTM_ID && (
          <Script id="gtm-head" strategy="lazyOnload">
            {`(function(){var done=false,ev=['scroll','pointerdown','keydown','touchstart'];
function go(){if(done)return;done=true;ev.forEach(function(e){removeEventListener(e,go,true)});
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');}
ev.forEach(function(e){addEventListener(e,go,{capture:true,passive:true,once:true})});
setTimeout(go,4000);})();`}
          </Script>
        )}
      </head>
      <body suppressHydrationWarning>
        {GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
        <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
          <SessionProvider>
            <SavedItemsProvider>
              {children}
              <ScrollProgress />
              {/* <StickyMobileCta /> removed 2026-08-06 (client request): the
                  "Find a verified clinic" bar is gone from every page on mobile.
                  The clinic profile has its own BookPill instead. */}
              {chatWidgetEnabled && <AssistantWidget />}
              <AnalyticsBeacon />
            </SavedItemsProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
