'use client'

import { useState } from 'react'

type Props = {
  source?: 'footer' | 'guide' | 'other'
  heading?: string
  subtext?: string
  /** Set true when the signup sits on an always-dark section (footer). */
  darkBg?: boolean
}

/**
 * General newsletter signup (footer, guide pages).
 * Calls POST /api/newsletter/subscribe. After submit shows the "check your email"
 * confirmation message. Double opt-in confirm happens in the email link.
 */
export function NewsletterSignup({
  source = 'footer',
  heading = 'Stay in the loop.',
  subtext = 'Treatment guides, verified injector spotlights, and industry news. No spam.',
  darkBg = false,
}: Props) {
  const inputCls = darkBg
    ? 'w-full rounded-sm border border-white/20 bg-white/10 px-4 py-2.5 text-body-sm text-white placeholder:text-white/50 focus:outline-none focus:border-white/50 transition'
    : 'w-full rounded-sm border border-border bg-surface-canvas px-4 py-2.5 text-body-sm text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-brand-accent transition'
  const labelCls = darkBg ? 'text-body-sm font-semibold text-white mb-1' : 'text-body-sm font-semibold text-ink-primary mb-1'
  const subtextCls = darkBg ? 'text-caption text-white/60 mb-4' : 'text-caption text-ink-secondary mb-4'
  const footerCls = darkBg ? 'text-caption text-white/40' : 'text-caption text-ink-tertiary'
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'loading') return
    setState('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, source, interestType: 'general' }),
      })
      if (res.ok) {
        setState('sent')
      } else {
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data?.error || 'Something went wrong. Please try again.')
        setState('error')
      }
    } catch {
      setErrorMsg('Could not connect. Check your internet and try again.')
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-brand-accent/30 bg-brand-accent-soft px-5 py-4">
        <span className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <div>
          <p className="text-body-sm font-semibold text-ink-primary">Check your inbox.</p>
          <p className="text-caption text-ink-secondary mt-0.5">
            We sent a confirmation link to {email}. Click it to complete your subscription.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {heading && (
        <p className={labelCls}>{heading}</p>
      )}
      {subtext && (
        <p className={subtextCls}>{subtext}</p>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
        <input
          type="text"
          placeholder="First name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className={inputCls}
        />
        <div className="flex gap-2">
          <label htmlFor="nl-email" className="sr-only">Email address</label>
          <input
            id="nl-email"
            type="email"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            className={`flex-1 min-w-0 ${inputCls}`}
          />
          <button
            type="submit"
            disabled={state === 'loading'}
            className="flex-shrink-0 rounded-pill bg-brand-primary text-surface-canvas px-5 py-2.5 text-body-sm font-semibold hover:opacity-90 disabled:opacity-60 transition"
          >
            {state === 'loading' ? 'Sending...' : 'Subscribe'}
          </button>
        </div>
        {state === 'error' && (
          <p className="text-caption text-state-error">{errorMsg}</p>
        )}
        <p className={footerCls}>
          You will receive a confirmation email. Unsubscribe anytime.
        </p>
      </form>
    </div>
  )
}
