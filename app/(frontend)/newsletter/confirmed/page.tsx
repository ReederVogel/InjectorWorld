import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'

export const metadata = {
  title: { absolute: 'Subscription confirmed | injector.world' },
  robots: { index: false, follow: false },
}

export default async function NewsletterConfirmedPage({
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
          {error ? (
            <>
              <div className="w-14 h-14 rounded-full bg-surface-warm border border-border flex items-center justify-center mx-auto mb-6">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-tertiary">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h1 className="text-h2 text-ink-primary mb-3">
                {error === 'unsubscribed' ? 'Already unsubscribed' : 'Link not found'}
              </h1>
              <p className="text-body text-ink-secondary mb-8">
                {error === 'unsubscribed'
                  ? 'This address is marked unsubscribed. Sign up again below if you changed your mind.'
                  : 'This confirmation link is invalid or has expired. Try subscribing again.'}
              </p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full bg-brand-accent-soft flex items-center justify-center mx-auto mb-6">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3FA68A" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="text-h2 text-ink-primary mb-3">You are confirmed.</h1>
              <p className="text-body text-ink-secondary mb-8">
                Welcome to the injector.world newsletter. We will be in touch with treatment guides,
                verified injector spotlights, and news. No spam.
              </p>
            </>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/guides"
              className="rounded-pill bg-brand-primary text-surface-canvas px-6 py-3 text-body-sm font-semibold hover:opacity-90 transition"
            >
              Browse guides
            </Link>
            <Link
              href="/clinics"
              className="rounded-pill border border-border text-ink-primary px-6 py-3 text-body-sm font-semibold hover:bg-surface-warm transition"
            >
              Browse clinics
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
