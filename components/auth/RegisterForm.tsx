'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PasswordField } from './PasswordField'
import { useTurnstile } from '@/components/shared/useTurnstile'

type Role = 'patient' | 'provider' | 'clinic'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

function inputClass() {
  return 'w-full px-4 py-3 rounded-md border border-border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body-sm'
}

function labelClass() {
  return 'block text-body-sm font-medium text-ink-primary mb-1.5'
}

export function RegisterForm() {
  const [step, setStep] = useState<'role' | 'form'>('role')
  const [role, setRole] = useState<Role>('patient')
  const [done, setDone] = useState(false)

  // Shared fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Provider-specific
  const [licenseNumber, setLicenseNumber] = useState('')
  const [licenseState, setLicenseState] = useState('')

  // Clinic owner-specific
  const [businessName, setBusinessName] = useState('')
  const [clinicName, setClinicName] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { token: turnstileToken, containerRef: turnstileRef, reset: resetTurnstile, siteKey } = useTurnstile()

  function selectRole(r: Role) {
    setRole(r)
    setStep('form')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const body: Record<string, string> = { role, email, password }
      if (role === 'patient') {
        body.name = name
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, cfTurnstileToken: turnstileToken || undefined }),
          credentials: 'include',
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(data.error || data.fieldErrors?.email || 'Could not create your account.')
          resetTurnstile()
          setLoading(false)
          return
        }
        setDone(true)
        return
      }

      if (role === 'provider') {
        body.name = name
        body.licenseNumber = licenseNumber
        body.licenseState = licenseState
      } else {
        body.name = businessName
        body.clinicName = clinicName
      }
      body.cfTurnstileToken = turnstileToken || ''

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Could not submit your application.')
        resetTurnstile()
        setLoading(false)
        return
      }

      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
      resetTurnstile()
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-brand-accent-soft mx-auto">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-accent">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h2 className="font-serif text-h3 text-ink-primary">
          {role === 'patient' ? 'Account created' : 'Application received'}
        </h2>
        <p className="text-body text-ink-secondary">
          {role === 'patient'
            ? 'Your account is ready. You can sign in now.'
            : 'We received your application. An admin will review it and you\'ll hear back within 1-2 business days.'}
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center bg-brand-primary text-surface-canvas rounded-pill px-8 py-3 text-body-sm font-semibold hover:opacity-90 transition mt-2"
        >
          Sign in
        </Link>
      </div>
    )
  }

  if (step === 'role') {
    return (
      <div className="space-y-4">
        <p className="text-body-sm text-ink-secondary text-center mb-6">Who are you creating an account as?</p>
        {(
          [
            { value: 'patient' as Role, label: 'Patient', desc: 'Save providers, track consults, ask questions.' },
            { value: 'provider' as Role, label: 'Provider', desc: 'List your practice, manage leads, showcase your work.' },
            { value: 'clinic' as Role, label: 'Clinic Owner', desc: 'Manage your clinic page, team, and bookings.' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => selectRole(opt.value)}
            className="w-full text-left px-5 py-4 rounded-xl border border-border hover:border-brand-accent bg-surface hover:bg-brand-accent-soft/40 transition group"
          >
            <p className="text-body-sm font-semibold text-ink-primary group-hover:text-brand-accent transition">{opt.label}</p>
            <p className="text-caption text-ink-tertiary mt-0.5">{opt.desc}</p>
          </button>
        ))}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot: hidden from humans, filled by bots — server discards if non-empty */}
      <input name="website" type="text" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <button
        type="button"
        onClick={() => { setStep('role'); setError('') }}
        className="flex items-center gap-1.5 text-caption text-ink-tertiary hover:text-ink-primary transition mb-2"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
        Back
      </button>

      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill bg-brand-accent-soft text-brand-accent text-caption font-semibold">
        {role === 'patient' ? 'Patient account' : role === 'provider' ? 'Provider account' : 'Clinic owner account'}
      </div>

      {role === 'clinic' ? (
        <>
          <div>
            <label htmlFor="businessName" className={labelClass()}>Your name</label>
            <input id="businessName" type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required autoComplete="name" placeholder="Your full name" className={inputClass()} />
          </div>
          <div>
            <label htmlFor="clinicName" className={labelClass()}>Clinic name</label>
            <input id="clinicName" type="text" value={clinicName} onChange={(e) => setClinicName(e.target.value)} required placeholder="e.g. Park Avenue Aesthetics" className={inputClass()} />
          </div>
        </>
      ) : (
        <div>
          <label htmlFor="name" className={labelClass()}>Full name</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="Your full name" className={inputClass()} />
        </div>
      )}

      <div>
        <label htmlFor="email" className={labelClass()}>Email address</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@email.com" className={inputClass()} />
      </div>

      {role === 'provider' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="licenseState" className={labelClass()}>License state</label>
            <select
              id="licenseState"
              value={licenseState}
              onChange={(e) => setLicenseState(e.target.value)}
              required
              className={inputClass()}
            >
              <option value="">Select state</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="licenseNumber" className={labelClass()}>License number</label>
            <input id="licenseNumber" type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required placeholder="e.g. RN123456" className={inputClass()} />
          </div>
        </div>
      )}

      <PasswordField id="new-password" label="Password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} placeholder="At least 8 characters" />

      {siteKey && (
        <div>
          <div ref={turnstileRef} />
        </div>
      )}

      {error && (
        <p className="text-body-sm text-[#B91C1C] bg-[#B91C1C]/5 px-4 py-3 rounded-md border border-[#B91C1C]/20">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand-primary text-surface-canvas rounded-pill py-3 text-body-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
      >
        {loading ? 'Creating account...' : role === 'patient' ? 'Create account' : 'Submit application'}
      </button>

      <p className="text-caption text-ink-tertiary text-center">
        By creating an account you agree to our{' '}
        <Link href="/terms" className="text-brand-accent hover:underline">Terms</Link> and{' '}
        <Link href="/privacy" className="text-brand-accent hover:underline">Privacy Policy</Link>.
      </p>
    </form>
  )
}
