'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // In production this is where Sentry.captureException(error) would go.
    console.error('[app error boundary]', error)
  }, [error])

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-5 bg-surface-canvas">
      <div className="text-center max-w-xl py-20">
        <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-4 block">
          Something went wrong
        </span>
        <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-4">
          We hit an unexpected error
        </h1>
        <p className="text-body-lg text-ink-secondary mb-8">
          Sorry about that. You can try again, or head back to the homepage.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={reset}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-pill bg-brand-primary text-surface-canvas text-body-sm font-semibold hover:opacity-90 transition"
          >
            Try again
          </button>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-pill border border-border text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:text-brand-accent transition"
          >
            Back to homepage
          </Link>
        </div>
      </div>
    </div>
  )
}
