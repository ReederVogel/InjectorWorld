'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PasswordField } from './PasswordField'

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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
    setLoading(true)
    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.errors?.[0]?.message || 'This reset link is invalid or has expired. Request a new one.')
        setLoading(false)
        return
      }
      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <p className="text-body-sm text-ink-secondary">
        This reset link is missing its token.{' '}
        <Link href="/forgot-password" className="text-brand-accent hover:underline">Request a new one</Link>.
      </p>
    )
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-brand-accent-soft border border-brand-accent/20">
          <svg className="flex-shrink-0 mt-0.5 text-brand-accent" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p className="text-body-sm text-ink-primary">
            Your password has been reset. You can sign in with your new password now.
          </p>
        </div>
        <Link
          href="/login"
          className="flex w-full items-center justify-center bg-brand-primary text-surface-canvas rounded-pill py-3 text-body-sm font-semibold hover:opacity-90 transition"
        >
          Go to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PasswordField
        id="new-password"
        label="New password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        minLength={8}
        placeholder="At least 8 characters"
      />
      <PasswordField
        id="confirm-password"
        label="Confirm new password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        minLength={8}
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
        {loading ? 'Resetting...' : 'Reset password'}
      </button>
    </form>
  )
}
