import Link from 'next/link'

export function QuizPromoCard() {
  return (
    <section className="section-pad bg-surface-warm">
      <div className="max-canvas">
        <div className="rounded-2xl border border-border bg-surface-canvas p-8 md:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">

          {/* Icon */}
          <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-brand-accent-soft flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
              <circle cx="12" cy="17" r="0.5" fill="rgb(var(--brand-accent))" />
            </svg>
          </div>

          {/* Text */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="font-serif text-h3 md:text-h2 text-ink-primary mb-2 leading-snug">
              Not sure where to start?
            </h2>
            <p className="text-body text-ink-secondary max-w-md">
              Answer 3 quick questions and get an educational recommendation on which treatment might suit your concern.
            </p>
            <p className="text-caption text-ink-tertiary mt-2">
              Takes 30 seconds. Not medical advice.
            </p>
          </div>

          {/* CTA */}
          <div className="flex-shrink-0">
            <Link
              href="/quiz"
              className="inline-flex items-center gap-2 bg-brand-primary text-surface-canvas rounded-pill px-6 py-3 text-body-sm font-semibold hover:opacity-90 transition"
            >
              Find my treatment
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
