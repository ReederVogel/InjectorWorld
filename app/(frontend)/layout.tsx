import type { Metadata } from 'next'
import Script from 'next/script'
import { Playfair_Display, Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import { SessionProvider } from '@/components/account/SessionContext'
import { SavedItemsProvider } from '@/components/account/SavedItemsProvider'
import { StickyMobileCta } from '@/components/ui/StickyMobileCta'
import { ScrollProgress } from '@/components/ui/ScrollProgress'
import { SiteRobotsTag } from '@/components/SiteRobotsTag'
import { AssistantWidget } from '@/components/assistant/AssistantWidget'
import { AnalyticsBeacon } from '@/components/analytics/AnalyticsBeacon'
import { DEFAULT_OG_IMAGES } from '@/lib/seo-defaults'
import { getSiteConfig } from '@/lib/site-config-queries'
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
  const { metaTitle, metaDescription, ogImageUrl } = await getSiteConfig()
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
    // robots tag is dynamic — controlled via admin toggle → SiteRobotsTag component
  }
}

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  const { chatWidgetEnabled } = await getSiteConfig()
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${playfairDisplay.variable}`}>
      <head>
        <SiteRobotsTag />
        {GTM_ID && (
          <Script id="gtm-head" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
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
              <StickyMobileCta />
              {chatWidgetEnabled && <AssistantWidget />}
              <AnalyticsBeacon />
            </SavedItemsProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
