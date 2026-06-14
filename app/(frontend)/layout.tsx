import type { Metadata } from 'next'
import Script from 'next/script'
import { Fraunces, Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import { SavedItemsProvider } from '@/components/account/SavedItemsProvider'
import { StickyMobileCta } from '@/components/ui/StickyMobileCta'
import { ScrollProgress } from '@/components/ui/ScrollProgress'
import '../globals.css'

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
})

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
  axes: ['opsz'],
})

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'injector.world'
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} — Find a verified injector you can actually trust`,
    template: `%s | ${siteName}`,
  },
  description:
    'License-verified Botox and aesthetic injectors near you. Read expert-reviewed treatment guides and patient reviews before you book.',
  openGraph: { type: 'website', siteName, url: siteUrl },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${fraunces.variable}`}>
      <head>
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
      <body>
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
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SavedItemsProvider>
            {children}
            <ScrollProgress />
            <StickyMobileCta />
          </SavedItemsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
