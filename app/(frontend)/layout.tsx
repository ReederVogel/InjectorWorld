import type { Metadata } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import { SavedItemsProvider } from '@/components/account/SavedItemsProvider'
import { StickyMobileCta } from '@/components/ui/StickyMobileCta'
import { ScrollProgress } from '@/components/ui/ScrollProgress'
import '../globals.css'

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
      <body>
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
