import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'

export const metadata = {
  title: { absolute: 'Unsubscribed | injector.world' },
  robots: { index: false, follow: false },
}

export default async function NewsletterUnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <>
      <Header />
      <main className="min-h-[60vh] flex items-center justify-center px-5 py-24">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-surface-warm border border-border flex items-center justify-center mx-auto mb-6">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-secondary">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </div>

          {error ? (
            <>
              <h1 className="text-h2 text-ink-primary mb-3">Link not found</h1>
              <p className="text-body text-ink-secondary mb-8">
                This unsubscribe link is invalid or has already been used.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-h2 text-ink-primary mb-3">You have been unsubscribed.</h1>
              <p className="text-body text-ink-secondary mb-8">
                You will not receive any further emails from injector.world. The site and guides
                remain available at any time.
              </p>
            </>
          )}

          <Link
            href="/"
            className="rounded-pill border border-border text-ink-primary px-6 py-3 text-body-sm font-semibold hover:bg-surface-warm transition"
          >
            Back to injector.world
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
