'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PasswordField } from './PasswordField'

export function SignupForm({ redirect }: { redirect?: string }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || data.fieldErrors?.password || data.fieldErrors?.email || 'Could not create your account.')
        setLoading(false)
        return
      }

      // Account created. Log in to set the session cookie, then hard-navigate so
      // the layout remounts (header updates, localStorage saves migrate).
      const loginRes = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      })
      if (!loginRes.ok) {
        // Account exists but auto-login failed; send them to sign in.
        window.location.assign('/login')
        return
      }
      window.location.assign(redirect || '/profile')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="name" className="block text-body-sm font-medium text-ink-primary mb-1.5">
          Full name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
          placeholder="Your name"
          className="w-full px-4 py-3 rounded-md border border-border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body-sm"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-body-sm font-medium text-ink-primary mb-1.5">
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@email.com"
          className="w-full px-4 py-3 rounded-md border border-border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body-sm"
        />
      </div>

      <PasswordField
        id="new-password"
        label="Password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        minLength={8}
        placeholder="At least 8 characters"
      />

      {error && (
        <p className="text-body-sm text-[#B91C1C] bg-[#B91C1C]/5 px-4 py-3 rounded-md border border-[#B91C1C]/20">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand-primary text-surface-canvas rounded-pill py-3 text-body-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
      >
        {loading ? 'Creating your account...' : 'Create account'}
      </button>

      <p className="text-caption text-ink-tertiary text-center">
        By creating an account you agree to our{' '}
        <Link href="/terms" className="text-brand-accent hover:underline">Terms</Link> and{' '}
        <Link href="/privacy" className="text-brand-accent hover:underline">Privacy Policy</Link>.
      </p>
    </form>
  )
}
