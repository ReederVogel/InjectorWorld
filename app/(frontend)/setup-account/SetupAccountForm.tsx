'use client'

import { useState } from 'react'

export function SetupAccountForm({ token }: { token: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/auth/setup-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Something went wrong. Please try again.')
        return
      }
      setDone(true)
      setSignedIn(Boolean(json.signedIn))
      if (json.signedIn) {
        // Hard navigation so the persistent header remounts with the
        // logged-in state. /dashboard routes to the right role dashboard.
        setTimeout(() => window.location.assign('/dashboard'), 1500)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="inline-flex w-12 h-12 rounded-full bg-brand-accent-soft items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="font-semibold text-body text-ink-primary mb-1">Password set.</p>
        {signedIn ? (
          <p className="text-body-sm text-ink-secondary">You are signed in. Taking you to your dashboard…</p>
        ) : (
          <p className="text-body-sm text-ink-secondary">
            <a href="/login?next=/dashboard" className="text-brand-accent hover:underline">Sign in</a>{' '}
            with your new password to open your dashboard.
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-body-sm font-medium text-ink-primary mb-1.5" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          placeholder="At least 8 characters"
          className="w-full px-4 py-3 rounded-lg border border-border bg-surface-canvas text-body text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-brand-accent transition"
        />
      </div>

      <div>
        <label className="block text-body-sm font-medium text-ink-primary mb-1.5" htmlFor="confirm">
          Confirm password
        </label>
        <input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          placeholder="Repeat your password"
          className="w-full px-4 py-3 rounded-lg border border-border bg-surface-canvas text-body text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-brand-accent transition"
        />
      </div>

      {error && (
        <p className="text-body-sm text-state-error">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full bg-brand-primary text-surface-canvas rounded-control py-3.5 text-body font-semibold hover:opacity-90 transition disabled:opacity-50"
      >
        {busy ? 'Setting password…' : 'Set password and sign in'}
      </button>
    </form>
  )
}
