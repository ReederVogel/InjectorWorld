'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SetupAccountForm({ token }: { token: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

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
      setTimeout(() => router.push('/dashboard'), 2000)
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
        <p className="text-body-sm text-ink-secondary">Redirecting to your dashboard…</p>
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
        className="w-full bg-brand-primary text-surface-canvas rounded-pill py-3.5 text-body font-semibold hover:opacity-90 transition disabled:opacity-50"
      >
        {busy ? 'Setting password…' : 'Set password and sign in'}
      </button>
    </form>
  )
}
