'use client'

import { useState } from 'react'

type Props = {
  claimType: 'provider' | 'clinic'
  targetId: string
  targetName: string
}

export function ClaimForm({ claimType, targetId, targetName }: Props) {
  const [fields, setFields] = useState({
    claimantName: '',
    claimantEmail: '',
    claimantPhone: '',
    roleAtPractice: '',
    licenseNumber: '',
    npiNumber: '',
    businessProof: '',
    message: '',
    password: '',
    createAccount: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')

  function set(key: keyof typeof fields, value: string | boolean) {
    setFields((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setServerError('')
    setLoading(true)

    const body: Record<string, unknown> = {
      claimType,
      targetId,
      claimantName: fields.claimantName,
      claimantEmail: fields.claimantEmail,
      claimantPhone: fields.claimantPhone || undefined,
      roleAtPractice: fields.roleAtPractice,
      licenseNumber: fields.licenseNumber || undefined,
      npiNumber: fields.npiNumber || undefined,
      businessProof: fields.businessProof || undefined,
      message: fields.message || undefined,
    }

    if (fields.createAccount && fields.password) {
      body.password = fields.password
    }

    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (data.fieldErrors) {
          setErrors(data.fieldErrors)
        } else {
          setServerError(data.error || 'Something went wrong. Please try again.')
        }
        setLoading(false)
        return
      }

      setSubmitted(true)
    } catch {
      setServerError('Network error. Please check your connection and try again.')
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-4 space-y-4">
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-accent-soft">
          <svg className="text-brand-accent" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <h2 className="font-serif text-h3 text-ink-primary">Claim submitted</h2>
        <p className="text-body text-ink-secondary max-w-sm mx-auto">
          Thank you. Our team will verify your credentials for {targetName} within 2 to 3 business days. Check your email for updates.
        </p>
        {fields.createAccount && (
          <p className="text-body-sm text-ink-secondary">
            Your account has been created. You can{' '}
            <a href="/login" className="text-brand-accent hover:underline">
              sign in
            </a>{' '}
            now and access your dashboard once the claim is approved.
          </p>
        )}
      </div>
    )
  }

  const isProvider = claimType === 'provider'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Personal info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          id="claimantName"
          label="Your full name"
          required
          value={fields.claimantName}
          onChange={(v) => set('claimantName', v)}
          error={errors.claimantName}
          placeholder="Dr. Jane Smith"
        />
        <Field
          id="claimantEmail"
          label="Email address"
          type="email"
          required
          value={fields.claimantEmail}
          onChange={(v) => set('claimantEmail', v)}
          error={errors.claimantEmail}
          placeholder="jane@clinic.com"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          id="claimantPhone"
          label="Phone number"
          type="tel"
          value={fields.claimantPhone}
          onChange={(v) => set('claimantPhone', v)}
          error={errors.claimantPhone}
          placeholder="(555) 000-0000"
        />
        <Field
          id="roleAtPractice"
          label="Your role at the practice"
          required
          value={fields.roleAtPractice}
          onChange={(v) => set('roleAtPractice', v)}
          error={errors.roleAtPractice}
          placeholder="Owner, Medical Director, Lead Injector..."
        />
      </div>

      {/* Provider-specific */}
      {isProvider && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            id="licenseNumber"
            label="License number"
            value={fields.licenseNumber}
            onChange={(v) => set('licenseNumber', v)}
            error={errors.licenseNumber}
            placeholder="RN-12345"
          />
          <Field
            id="npiNumber"
            label="NPI number (optional)"
            value={fields.npiNumber}
            onChange={(v) => set('npiNumber', v)}
            error={errors.npiNumber}
            placeholder="1234567890"
          />
        </div>
      )}

      {/* Clinic-specific */}
      {!isProvider && (
        <Field
          id="businessProof"
          label="Business proof (website, LLC docs, Google Business URL)"
          value={fields.businessProof}
          onChange={(v) => set('businessProof', v)}
          error={errors.businessProof}
          placeholder="https://yourclinic.com"
        />
      )}

      <div>
        <label htmlFor="message" className="block text-body-sm font-medium text-ink-primary mb-1.5">
          Additional context (optional)
        </label>
        <textarea
          id="message"
          rows={3}
          value={fields.message}
          onChange={(e) => set('message', e.target.value)}
          placeholder="Anything that will help us verify your claim faster."
          className="w-full px-4 py-3 rounded-md border border-border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body-sm resize-none"
        />
      </div>

      {/* Account creation (optional) */}
      <div className="pt-2 border-t border-border-subtle space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={fields.createAccount}
            onChange={(e) => set('createAccount', e.target.checked)}
            className="w-4 h-4 rounded border-border text-brand-accent accent-brand-accent"
          />
          <span className="text-body-sm text-ink-primary">Create an account so I can sign in once approved</span>
        </label>

        {fields.createAccount && (
          <Field
            id="password"
            label="Password"
            type="password"
            required
            value={fields.password}
            onChange={(v) => set('password', v)}
            error={errors.password}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        )}
      </div>

      {serverError && (
        <p className="text-body-sm text-[#B91C1C] bg-[#B91C1C]/5 px-4 py-3 rounded-md border border-[#B91C1C]/20">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand-primary text-surface-canvas rounded-pill py-3 text-body-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Submit claim'}
      </button>

      <p className="text-caption text-ink-tertiary text-center">
        Already have an account?{' '}
        <a href="/login" className="text-brand-accent hover:underline">
          Sign in
        </a>
      </p>
    </form>
  )
}

function Field({
  id,
  label,
  type = 'text',
  required,
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
}: {
  id: string
  label: string
  type?: string
  required?: boolean
  value: string
  onChange: (v: string) => void
  error?: string
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-body-sm font-medium text-ink-primary mb-1.5">
        {label}{required && <span className="text-[#B91C1C] ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`w-full px-4 py-3 rounded-md border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body-sm ${
          error ? 'border-[#B91C1C]' : 'border-border'
        }`}
      />
      {error && <p className="text-caption text-[#B91C1C] mt-1">{error}</p>}
    </div>
  )
}
