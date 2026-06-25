'use client'

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

type TreatmentOption = { id: number; name: string }
type BookingKind = 'provider' | 'clinic'
type FormState = 'idle' | 'submitting' | 'success'

type BookingModalProps = {
  kind: BookingKind
  targetId: number
  targetName: string
  treatmentsOffered?: TreatmentOption[]
  open: boolean
  onClose: () => void
}

const DATE_RANGE_OPTIONS = [
  { value: 'next-7-days', label: 'Next 7 days' },
  { value: 'next-2-weeks', label: 'Next 2 weeks' },
  { value: 'next-month', label: 'Next month' },
  { value: 'flexible', label: 'Flexible' },
] as const

export function BookingModal({
  kind,
  targetId,
  targetName,
  treatmentsOffered = [],
  open,
  onClose,
}: BookingModalProps) {
  const [state, setState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [turnstileReady, setTurnstileReady] = useState(false)
  const turnstileContainerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<string | number | undefined>(undefined)
  const tokenResolverRef = useRef<((token?: string) => void) | null>(null)
  const warnedMissingKeyRef = useRef(false)

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  useEffect(() => {
    if (!open || state !== 'success') return
    const timer = window.setTimeout(onClose, 5000)
    return () => window.clearTimeout(timer)
  }, [onClose, open, state])

  useEffect(() => {
    if (!open) {
      setState('idle')
      setErrorMsg('')
      setFieldErrors({})
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    if (!siteKey) {
      if (!warnedMissingKeyRef.current) {
        console.warn('[booking] NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set. Rendering booking form without Turnstile.')
        warnedMissingKeyRef.current = true
      }
      return
    }
    if (!turnstileContainerRef.current) return

    const renderWidget = () => {
      if (!turnstileContainerRef.current || widgetRef.current !== undefined) return
      const turnstile = (window as any).turnstile
      if (!turnstile) return
      widgetRef.current = turnstile.render(turnstileContainerRef.current, {
        sitekey: siteKey,
        execution: 'execute',
        appearance: 'execute',
        callback: (token: string) => {
          tokenResolverRef.current?.(token)
          tokenResolverRef.current = null
        },
        'expired-callback': () => {
          tokenResolverRef.current?.(undefined)
          tokenResolverRef.current = null
        },
        'error-callback': () => {
          tokenResolverRef.current?.(undefined)
          tokenResolverRef.current = null
        },
      })
      setTurnstileReady(true)
    }

    if ((window as any).turnstile) {
      renderWidget()
      return
    }

    const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]') as HTMLScriptElement | null
    if (!existing) {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.onload = renderWidget
      document.head.appendChild(script)
      return
    }

    existing.addEventListener('load', renderWidget)
    return () => existing.removeEventListener('load', renderWidget)
  }, [open, siteKey])

  useEffect(() => {
    return () => {
      if (widgetRef.current !== undefined && (window as any).turnstile) {
        ;(window as any).turnstile.remove(widgetRef.current)
        widgetRef.current = undefined
      }
    }
  }, [])

  if (!open) return null

  async function getTurnstileToken(): Promise<string | undefined> {
    if (!siteKey) return undefined
    const turnstile = (window as any).turnstile
    if (!turnstile || widgetRef.current === undefined || !turnstileReady) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[booking] Turnstile is not ready. Continuing in development mode.')
        return undefined
      }
      throw new Error('Turnstile is not ready. Please try again.')
    }

    return await new Promise<string | undefined>((resolve) => {
      tokenResolverRef.current = resolve
      try {
        turnstile.execute(turnstileContainerRef.current)
      } catch (error) {
        tokenResolverRef.current = null
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[booking] Turnstile execution failed. Continuing in development mode.', error)
          resolve(undefined)
          return
        }
        throw error
      }
      window.setTimeout(() => {
        if (tokenResolverRef.current) {
          tokenResolverRef.current(undefined)
          tokenResolverRef.current = null
        }
      }, 10000)
    }).then((token) => {
      if (!token && process.env.NODE_ENV !== 'production') {
        console.warn('[booking] Turnstile did not return a token. Continuing in development mode.')
        return undefined
      }
      return token
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('submitting')
    setErrorMsg('')
    setFieldErrors({})

    const form = event.currentTarget
    const formData = new FormData(form)
    const selectedTreatmentId = Number(formData.get('treatmentId') || 0)
    const selectedTreatment = treatmentsOffered.find((t) => t.id === selectedTreatmentId)

    try {
      const turnstileToken = await getTurnstileToken()
      const body = {
        kind,
        targetId,
        targetName,
        patientName: String(formData.get('patientName') || ''),
        patientEmail: String(formData.get('patientEmail') || ''),
        patientPhone: String(formData.get('patientPhone') || ''),
        treatmentId: selectedTreatmentId > 0 ? selectedTreatmentId : undefined,
        treatmentName: selectedTreatment?.name || '',
        preferredDateRange: String(formData.get('preferredDateRange') || 'flexible'),
        message: String(formData.get('message') || ''),
        turnstileToken,
        _hp: String(formData.get('website') || ''),
      }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        setState('idle')
        setFieldErrors(json.fieldErrors || {})
        setErrorMsg(json.error || 'Please try again.')
        return
      }

      setState('success')
      form.reset()
    } catch (error) {
      setState('idle')
      setErrorMsg((error as Error)?.message || 'Please try again.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="max-h-[calc(100vh-3rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface-canvas shadow-hover">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id="booking-modal-title" className="font-serif text-h3 text-ink-primary">
              Request a consultation at {targetName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border border-border text-ink-secondary transition hover:bg-surface hover:text-ink-primary"
            aria-label="Close booking form"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {state === 'success' ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-pill bg-brand-accent-soft text-brand-accent">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="font-serif text-h3 text-ink-primary">Request sent.</h3>
            <p className="mt-2 text-body-sm text-ink-secondary">
              The clinic will reach out by email within 1-2 days.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4 px-5 py-5">
            <input name="website" type="text" tabIndex={-1} style={{ display: 'none' }} autoComplete="off" aria-hidden="true" />

            <Field label="Name" required error={fieldErrors.patientName}>
              <input
                name="patientName"
                type="text"
                autoComplete="name"
                required
                className={inputClass(fieldErrors.patientName)}
              />
            </Field>

            <Field label="Email" required error={fieldErrors.patientEmail}>
              <input
                name="patientEmail"
                type="email"
                autoComplete="email"
                required
                className={inputClass(fieldErrors.patientEmail)}
              />
            </Field>

            <Field label="Phone" optional error={fieldErrors.patientPhone}>
              <input
                name="patientPhone"
                type="tel"
                autoComplete="tel"
                className={inputClass(fieldErrors.patientPhone)}
              />
            </Field>

            <Field label="Treatment of interest" error={fieldErrors.treatmentId}>
              <select name="treatmentId" defaultValue="0" className={inputClass(fieldErrors.treatmentId)}>
                <option value="0">Not sure yet</option>
                {treatmentsOffered.map((treatment) => (
                  <option key={`${treatment.id}-${treatment.name}`} value={treatment.id}>
                    {treatment.name}
                  </option>
                ))}
              </select>
            </Field>

            <fieldset>
              <legend className="mb-2 block text-body-sm font-medium text-ink-primary">
                Preferred date range
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {DATE_RANGE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-body-sm text-ink-secondary transition hover:border-brand-accent"
                  >
                    <input
                      name="preferredDateRange"
                      type="radio"
                      value={option.value}
                      defaultChecked={option.value === 'flexible'}
                      className="h-4 w-4 accent-brand-accent"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              {fieldErrors.preferredDateRange && (
                <p className="mt-1 text-caption text-state-error">{fieldErrors.preferredDateRange}</p>
              )}
            </fieldset>

            <Field label="Message" optional error={fieldErrors.message}>
              <textarea
                name="message"
                rows={4}
                className={`${inputClass(fieldErrors.message)} resize-none`}
              />
            </Field>

            <div ref={turnstileContainerRef} className="min-h-0" aria-hidden="true" />

            <p className="text-caption text-ink-tertiary">
              We pass your request to the clinic. No payment is taken.
            </p>

            {errorMsg && (
              <p role="alert" className="rounded-lg border border-state-error/20 bg-state-error/5 px-4 py-3 text-body-sm text-state-error">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={state === 'submitting'}
              className="flex min-h-11 w-full items-center justify-center rounded-pill bg-brand-primary px-5 py-3 text-body-sm font-semibold text-surface-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === 'submitting' ? 'Sending...' : 'Send request'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  optional,
  error,
  children,
}: {
  label: string
  required?: boolean
  optional?: boolean
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-body-sm font-medium text-ink-primary">
        {label}
        {required && <span className="text-state-error"> *</span>}
        {optional && <span className="ml-1 text-caption font-normal text-ink-tertiary">optional</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-caption text-state-error">{error}</span>}
    </label>
  )
}

function inputClass(error?: string): string {
  return `w-full rounded-sm border bg-surface-canvas px-3.5 py-2.5 text-base text-ink-primary transition focus:border-brand-accent focus:outline-none ${
    error ? 'border-state-error' : 'border-border'
  }`
}
