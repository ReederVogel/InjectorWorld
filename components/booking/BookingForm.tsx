'use client'

import { useState } from 'react'

type BookingFormProps = {
  providerId: string
  providerName: string
  providerFirstName: string
  clinicId?: string
  treatmentOptions: string[]
}

type FormState = 'idle' | 'submitting' | 'success' | 'error'

export function BookingForm({
  providerId,
  providerName,
  providerFirstName,
  clinicId,
  treatmentOptions,
}: BookingFormProps) {
  const [state, setState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('submitting')
    setErrorMsg('')
    setFieldErrors({})

    const form = e.currentTarget
    const data = new FormData(form)

    const body = {
      firstName: (data.get('firstName') as string).trim(),
      lastName: (data.get('lastName') as string).trim(),
      email: (data.get('email') as string).trim(),
      phone: (data.get('phone') as string).trim(),
      treatmentTag: data.get('treatmentTag') as string,
      preferredDate: data.get('preferredDate') as string,
      message: (data.get('message') as string).trim(),
      consentToContact: data.get('consentToContact') === 'on',
      providerId,
      clinicId,
    }

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.fieldErrors) {
          setFieldErrors(json.fieldErrors)
          setState('idle')
        } else {
          setErrorMsg(json.error || 'Something went wrong. Please try again.')
          setState('error')
        }
        return
      }
      setState('success')
    } catch {
      setErrorMsg('Unable to send your request. Please check your connection and try again.')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="rounded-2xl border border-brand-accent/30 bg-brand-accent-soft p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-brand-accent flex items-center justify-center mx-auto mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="font-serif text-h3 text-ink-primary mb-2">Request received</h3>
        <p className="text-body-sm text-ink-secondary">
          We have sent your consultation request to {providerFirstName}. You will receive a confirmation email shortly. Most providers respond within 24 hours.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Name row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-body-sm font-medium text-ink-primary mb-1.5">
            First name <span className="text-state-error">*</span>
          </label>
          <input
            name="firstName"
            type="text"
            required
            autoComplete="given-name"
            className={`w-full px-3.5 py-2.5 rounded-sm border text-body-sm text-ink-primary bg-surface-canvas focus:outline-none focus:border-brand-accent transition ${
              fieldErrors.firstName ? 'border-state-error' : 'border-border'
            }`}
          />
          {fieldErrors.firstName && <p className="mt-1 text-caption text-state-error">{fieldErrors.firstName}</p>}
        </div>
        <div>
          <label className="block text-body-sm font-medium text-ink-primary mb-1.5">
            Last name <span className="text-state-error">*</span>
          </label>
          <input
            name="lastName"
            type="text"
            required
            autoComplete="family-name"
            className={`w-full px-3.5 py-2.5 rounded-sm border text-body-sm text-ink-primary bg-surface-canvas focus:outline-none focus:border-brand-accent transition ${
              fieldErrors.lastName ? 'border-state-error' : 'border-border'
            }`}
          />
          {fieldErrors.lastName && <p className="mt-1 text-caption text-state-error">{fieldErrors.lastName}</p>}
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-body-sm font-medium text-ink-primary mb-1.5">
          Email <span className="text-state-error">*</span>
        </label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className={`w-full px-3.5 py-2.5 rounded-sm border text-body-sm text-ink-primary bg-surface-canvas focus:outline-none focus:border-brand-accent transition ${
            fieldErrors.email ? 'border-state-error' : 'border-border'
          }`}
        />
        {fieldErrors.email && <p className="mt-1 text-caption text-state-error">{fieldErrors.email}</p>}
      </div>

      {/* Phone (optional) */}
      <div>
        <label className="block text-body-sm font-medium text-ink-primary mb-1.5">
          Phone <span className="text-caption font-normal text-ink-tertiary ml-1">optional</span>
        </label>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          className="w-full px-3.5 py-2.5 rounded-sm border border-border text-body-sm text-ink-primary bg-surface-canvas focus:outline-none focus:border-brand-accent transition"
        />
      </div>

      {/* Treatment select */}
      {treatmentOptions.length > 0 && (
        <div>
          <label className="block text-body-sm font-medium text-ink-primary mb-1.5">
            Treatment of interest
          </label>
          <select
            name="treatmentTag"
            defaultValue={treatmentOptions[0]}
            className="w-full px-3.5 py-2.5 rounded-sm border border-border text-body-sm text-ink-primary bg-surface-canvas focus:outline-none focus:border-brand-accent transition cursor-pointer"
          >
            {treatmentOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      )}

      {/* Preferred date (optional) */}
      <div>
        <label className="block text-body-sm font-medium text-ink-primary mb-1.5">
          Preferred date <span className="text-caption font-normal text-ink-tertiary ml-1">optional</span>
        </label>
        <input
          name="preferredDate"
          type="date"
          className="w-full px-3.5 py-2.5 rounded-sm border border-border text-body-sm text-ink-primary bg-surface-canvas focus:outline-none focus:border-brand-accent transition"
        />
      </div>

      {/* Message (optional) */}
      <div>
        <label className="block text-body-sm font-medium text-ink-primary mb-1.5">
          Message <span className="text-caption font-normal text-ink-tertiary ml-1">optional</span>
        </label>
        <textarea
          name="message"
          rows={3}
          placeholder={`Questions for ${providerFirstName}, areas of concern, etc.`}
          className="w-full px-3.5 py-2.5 rounded-sm border border-border text-body-sm text-ink-primary bg-surface-canvas focus:outline-none focus:border-brand-accent transition resize-none"
        />
      </div>

      {/* Consent */}
      <div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            name="consentToContact"
            type="checkbox"
            required
            className="mt-0.5 w-4 h-4 rounded border-border accent-brand-accent flex-shrink-0"
          />
          <span className="text-caption text-ink-secondary leading-relaxed">
            I consent to being contacted by {providerName} about this consultation request. I understand this is not a confirmed appointment.
          </span>
        </label>
        {fieldErrors.consentToContact && (
          <p className="mt-1 text-caption text-state-error">{fieldErrors.consentToContact}</p>
        )}
      </div>

      {/* Generic error */}
      {state === 'error' && errorMsg && (
        <p className="text-body-sm text-state-error bg-state-error/5 border border-state-error/20 rounded-lg px-4 py-3">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white rounded-pill py-3 text-body-sm font-semibold hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {state === 'submitting' ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity=".3" />
              <path d="M12 3a9 9 0 019 9" />
            </svg>
            Sending...
          </>
        ) : (
          'Send consultation request'
        )}
      </button>

      <p className="text-caption text-ink-tertiary text-center">
        Most providers respond within 24 hours. This is not a confirmed booking.
      </p>
    </form>
  )
}
