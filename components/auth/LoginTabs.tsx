'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LoginForm } from './LoginForm'

type Tab = 'patient' | 'practice'

/**
 * Two-audience login: patients on one tab, clinic owners and providers on the
 * other. Same auth API underneath — the tabs switch the copy and footer links
 * so each audience lands on the right onboarding path.
 * Staff do not sign in here: the Payload admin at /admin has its own login.
 */
export function LoginTabs({
  redirect,
  initialTab = 'patient',
}: {
  redirect?: string
  initialTab?: Tab
}) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const isPatient = tab === 'patient'

  return (
    <>
      <h1 className="font-serif text-h2 text-ink-primary mb-2">Sign in</h1>
      <p className="text-body text-ink-secondary mb-6">
        {isPatient
          ? 'Access your saved providers, consult requests, and account settings.'
          : 'Manage your clinic profile, photos, leads, and claim status.'}
      </p>

      {/* Tab toggle */}
      <div className="flex rounded-control border border-border bg-surface p-1 mb-6" role="tablist" aria-label="Account type">
        {([
          { key: 'patient', label: 'Patient' },
          { key: 'practice', label: 'Clinic & Provider' },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 min-h-11 rounded-control text-body-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
              tab === key
                ? 'bg-brand-primary text-surface-canvas'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 md:p-8">
        <LoginForm redirect={redirect} />
      </div>

      {isPatient ? (
        <p className="mt-6 text-body-sm text-ink-secondary text-center">
          New here?{' '}
          <Link
            href={redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : '/signup'}
            className="text-brand-accent hover:underline"
          >
            Create an account
          </Link>
        </p>
      ) : (
        <div className="mt-6 space-y-2 text-center">
          <p className="text-body-sm text-ink-secondary">
            Not listed yet?{' '}
            <Link href="/register" className="text-brand-accent hover:underline">
              Apply to join
            </Link>
          </p>
          <p className="text-caption text-ink-tertiary">
            Claiming an existing profile?{' '}
            <Link href="/list-your-practice" className="text-brand-accent hover:underline">
              Learn how listing works
            </Link>
          </p>
        </div>
      )}
    </>
  )
}
