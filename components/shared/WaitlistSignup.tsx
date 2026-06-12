'use client'

import { useState } from 'react'

/**
 * Coming-soon city waitlist. Saves to the Subscribers collection via
 * POST /api/newsletter/subscribe (double opt-in: confirm email is sent).
 */
export function WaitlistSignup({
  placeName,
  cityTag,
  stateCode,
}: {
  placeName: string
  cityTag?: string
  stateCode?: string
}) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'loading') return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return
    setState('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          source: 'waitlist',
          interestType: 'city-waitlist',
          cityTag: cityTag || placeName,
          stateCode: stateCode || undefined,
        }),
      })
      if (res.ok) {
        setState('sent')
      } else {
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data?.error || 'Something went wrong. Please try again.')
        setState('error')
      }
    } catch {
      setErrorMsg('Could not connect. Please try again.')
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-brand-accent/30 bg-brand-accent-soft px-5 py-4 text-left">
        <span className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-accent flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <div>
          <p className="text-body-sm font-semibold text-ink-primary">Check your inbox.</p>
          <p className="text-caption text-ink-secondary">
            We sent a confirmation link to {email}. Confirm it and we will email you the moment
            verified injectors go live in {placeName}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2.5">
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
          disabled={state === 'loading'}
          className="flex-shrink-0 rounded-pill bg-brand-primary text-surface-canvas px-6 py-3 text-body-sm font-semibold hover:opacity-90 disabled:opacity-60 transition"
        >
          {state === 'loading' ? 'Sending...' : 'Notify me'}
        </button>
      </form>
      {state === 'error' && (
        <p className="text-caption text-state-error mt-2">{errorMsg}</p>
      )}
      <p className="text-caption text-ink-tertiary mt-2 text-center">
        Confirm via email. Unsubscribe anytime.
      </p>
    </div>
  )
}
