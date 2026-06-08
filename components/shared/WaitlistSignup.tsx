'use client'

import { useState } from 'react'

/**
 * Coming-soon waitlist capture (Phase 3).
 * VISUAL-ONLY STUB: this does not persist anything yet. Real email capture wires
 * in Phase 10 (Newsletter / Subscribers collection + double opt-in). Until then it
 * just confirms intent to the visitor so the coming-soon page feels complete.
 */
export function WaitlistSignup({ placeName }: { placeName: string }) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-brand-accent/30 bg-brand-accent-soft px-5 py-4 text-left">
        <span className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-accent flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <div>
          <p className="text-body-sm font-semibold text-ink-primary">You are on the list.</p>
          <p className="text-caption text-ink-secondary">
            We will email you the moment verified injectors go live in {placeName}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2.5 w-full max-w-md mx-auto">
      <label htmlFor="waitlist-email" className="sr-only">
        Email address
      </label>
      <input
        id="waitlist-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        className="flex-1 min-w-0 rounded-pill border border-border bg-surface-canvas px-5 py-3 text-body-sm text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-brand-accent transition"
      />
      <button
        type="submit"
        className="flex-shrink-0 rounded-pill bg-brand-primary text-surface-canvas px-6 py-3 text-body-sm font-semibold hover:opacity-90 transition"
      >
        Notify me
      </button>
    </form>
  )
}
