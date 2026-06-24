'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export function VerifyEmailClient({ token }: { token: string }) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch(`/api/users/verify-email/${token}`, {
          method: 'POST',
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          setRole(data?.user?.role ?? null)
          setStatus('success')
        } else {
          setStatus('error')
        }
      } catch {
        setStatus('error')
      }
    }
    verify()
  }, [token])

  function getDashboard(r: string | null) {
    if (r === 'provider') return '/dashboard/provider'
    if (r === 'clinic') return '/dashboard/clinic'
    if (r === 'brand') return '/dashboard/brand'
    if (r === 'admin' || r === 'editor') return '/admin'
    return '/dashboard'
  }

  if (status === 'loading') {
    return (
      <div className="text-center py-8 space-y-3">
        <div className="inline-block w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-body text-ink-secondary">Verifying your email...</p>
      </div>
    )
  }

  if (status === 'success') {
    const dest = getDashboard(role)
    // Auto-redirect after a short delay
    if (typeof window !== 'undefined') {
      setTimeout(() => { window.location.assign(dest) }, 2500)
    }
    return (
      <div className="text-center py-4 space-y-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-brand-accent-soft mx-auto">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-accent">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h1 className="font-serif text-h3 text-ink-primary">Email verified</h1>
        <p className="text-body text-ink-secondary">
          Your email has been confirmed. Redirecting you now...
        </p>
        <Link
          href={dest}
          className="inline-flex items-center justify-center bg-brand-primary text-surface-canvas rounded-pill px-8 py-3 text-body-sm font-semibold hover:opacity-90 transition"
        >
          Go to dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="text-center py-4 space-y-4">
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#B91C1C]/10 mx-auto">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#B91C1C]">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h1 className="font-serif text-h3 text-ink-primary">Link expired or invalid</h1>
      <p className="text-body text-ink-secondary">
        This verification link has expired or has already been used.
      </p>
      <div className="flex flex-col gap-3 pt-2">
        <Link
          href="/login"
          className="inline-flex items-center justify-center bg-brand-primary text-surface-canvas rounded-pill px-8 py-3 text-body-sm font-semibold hover:opacity-90 transition"
        >
          Sign in
        </Link>
        <p className="text-body-sm text-ink-secondary">
          Need a new link?{' '}
          <Link href="/forgot-password" className="text-brand-accent hover:underline">
            Request one here
          </Link>
        </p>
      </div>
    </div>
  )
}
