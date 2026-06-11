'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PasswordField } from './PasswordField'

export function LoginForm({ redirect }: { redirect?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.errors?.[0]?.message || 'Invalid email or password.')
        setLoading(false)
        return
      }

      const data = await res.json()
      const role = data?.user?.role

      // Hard navigation so the persistent layout (header + SavedItemsProvider)
      // remounts: the header shows the logged-in state and any anonymous
      // localStorage saves migrate into the account.
      let dest = redirect || '/'
      if (!redirect) {
        if (role === 'provider') dest = '/dashboard'
        else if (role === 'admin' || role === 'editor') dest = '/admin'
        else dest = '/profile'
      }
      window.location.assign(dest)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
          placeholder="you@practice.com"
          className="w-full px-4 py-3 rounded-md border border-border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body-sm"
        />
      </div>

      <PasswordField
        id="password"
        label="Password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        rightSlot={
          <Link href="/forgot-password" className="text-caption text-brand-accent hover:underline">
            Forgot password?
          </Link>
        }
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
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  )
}
