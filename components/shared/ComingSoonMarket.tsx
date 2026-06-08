import Link from 'next/link'
import { WaitlistSignup } from './WaitlistSignup'

export type ComingSoonLink = { href: string; label: string }

/**
 * Coming-soon market block (Phase 3). Shown on state/city/city-directory pages
 * when the market is not yet live (`isLive === false`). Pairs a waitlist capture
 * (visual stub) with links onward to live markets so the visitor is never dead-ended.
 */
export function ComingSoonMarket({
  overline,
  title,
  placeName,
  links = [],
}: {
  overline: string
  title: string
  placeName: string
  links?: ComingSoonLink[]
}) {
  return (
    <section className="section-pad bg-surface-canvas">
      <div className="max-canvas">
        <div className="max-w-2xl mx-auto rounded-2xl border border-border bg-surface px-6 py-12 sm:px-12 sm:py-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-pill bg-brand-accent-soft px-3.5 py-1.5 text-caption font-semibold uppercase tracking-widest text-brand-accent mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent" aria-hidden />
            {overline}
          </span>

          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-4">
            {title}
          </h1>
          <p className="text-body-lg text-ink-secondary max-w-md mx-auto mb-8">
            We are verifying injectors in {placeName} right now. Leave your email and we will tell you
            the moment this market goes live.
          </p>

          <WaitlistSignup placeName={placeName} />

          {links.length > 0 && (
            <div className="mt-10 pt-8 border-t border-border-subtle">
              <p className="text-caption uppercase tracking-widest font-semibold text-ink-tertiary mb-4">
                Available now
              </p>
              <div className="flex flex-wrap gap-2.5 justify-center">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-border px-4 py-2 text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:text-brand-accent transition"
                  >
                    {l.label}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
