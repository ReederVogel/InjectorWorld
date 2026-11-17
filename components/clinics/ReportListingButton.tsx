'use client'

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTurnstile } from '@/components/shared/useTurnstile'
import { FieldHint } from '@/components/shared/FieldHint'
import { LISTING_REPORT_REASONS } from '@/lib/listing-report-reasons'

/**
 * "Report an issue with this listing" on the clinic profile. Replaced a
 * mailto:support@ link (2026-11-17): reports now land in the admin Inbox as
 * listing-reports via POST /api/listing-reports.
 *
 * Centered dialog from `sm` up, bottom sheet below it. The dialog is unmounted
 * when closed, so the form and the Turnstile widget reset on every open.
 */
export function ReportListingButton({ clinicId, clinicName }: { clinicId: number; clinicName: string }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="text-caption text-ink-tertiary underline transition hover:text-ink-primary"
      >
        Report an issue with this listing
      </button>
      {open && <ReportDialog clinicId={clinicId} clinicName={clinicName} onClose={close} />}
    </>
  )
}

function ReportDialog({
  clinicId,
  clinicName,
  onClose,
}: {
  clinicId: number
  clinicName: string
  onClose: () => void
}) {
  const [state, setState] = useState<'idle' | 'submitting' | 'success'>('idle')
  const [reason, setReason] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const firstFieldRef = useRef<HTMLSelectElement>(null)
  const { containerRef: turnstileRef, reset: resetTurnstile, siteKey, engaged, engage, waitForToken } = useTurnstile()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    firstFieldRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (state === 'submitting') return

    const form = event.currentTarget
    const formData = new FormData(form)
    const details = String(formData.get('details') || '').trim()
    const emailInput = form.elements.namedItem('reporterEmail') as HTMLInputElement | null

    const missing: Record<string, string> = {}
    if (!reason) missing.reason = 'Pick what is wrong'
    if (reason === 'other' && !details) missing.details = 'Tell us what is wrong'
    if (emailInput && !emailInput.validity.valid) missing.reporterEmail = 'Enter a valid email address'
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing)
      setErrorMsg('Please check the highlighted fields.')
      return
    }

    setState('submitting')
    setErrorMsg('')
    setFieldErrors({})

    try {
      const turnstileToken = await waitForToken()
      const res = await fetch('/api/listing-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          reason,
          details,
          reporterName: String(formData.get('reporterName') || ''),
          reporterEmail: String(formData.get('reporterEmail') || '').trim(),
          pageUrl: window.location.pathname,
          turnstileToken: turnstileToken || undefined,
          _hp: String(formData.get('website') || ''),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const hasFieldErrors = json.fieldErrors && Object.keys(json.fieldErrors).length > 0
        setFieldErrors(json.fieldErrors || {})
        setErrorMsg(hasFieldErrors ? 'Please check the highlighted fields.' : json.error || 'Please try again.')
        resetTurnstile()
        setState('idle')
        return
      }
      setState('success')
    } catch {
      setErrorMsg('Could not connect. Check your internet and try again.')
      resetTurnstile()
      setState('idle')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:px-4 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-listing-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface-canvas shadow-hover sm:max-h-[calc(100vh-3rem)] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="report-listing-title" className="font-serif text-h3 text-ink-primary">
              Report an issue
            </h2>
            <p className="mt-1 truncate text-body-sm text-ink-secondary">{clinicName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-ink-secondary transition hover:bg-surface hover:text-ink-primary"
            aria-label="Close report form"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {state === 'success' ? (
          <div className="px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent-soft text-brand-accent">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="font-serif text-h3 text-ink-primary">Thanks for the report.</h3>
            <p className="mt-2 text-body-sm text-ink-secondary">Our team will check this listing and fix what is wrong.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-control border border-border px-6 py-3 text-body-sm font-semibold text-ink-primary transition hover:bg-surface"
            >
              Close
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            onFocusCapture={engage}
            noValidate
            className="space-y-4 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5"
          >
            <input name="website" type="text" tabIndex={-1} style={{ display: 'none' }} autoComplete="off" aria-hidden="true" />

            <Field label="What is wrong?" required error={fieldErrors.reason}>
              <select
                ref={firstFieldRef}
                name="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className={inputClass(fieldErrors.reason)}
              >
                <option value="" disabled>
                  Choose one
                </option>
                {LISTING_REPORT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Details" required={reason === 'other'} optional={reason !== 'other'} error={fieldErrors.details}>
              <textarea
                name="details"
                rows={4}
                maxLength={2000}
                placeholder="What should it say instead?"
                className={`${inputClass(fieldErrors.details)} resize-none`}
              />
            </Field>

            <Field label="Your name" optional error={fieldErrors.reporterName}>
              <input name="reporterName" type="text" autoComplete="name" maxLength={160} className={inputClass(fieldErrors.reporterName)} />
            </Field>

            <Field label="Your email" optional error={fieldErrors.reporterEmail} hint="email">
              <input name="reporterEmail" type="email" autoComplete="email" maxLength={254} className={inputClass(fieldErrors.reporterEmail)} />
            </Field>
            <p className="-mt-2 text-caption text-ink-tertiary">Only if you want us to follow up with you.</p>

            {siteKey && engaged && <div ref={turnstileRef} />}

            {errorMsg && (
              <p role="alert" className="rounded-control border border-state-error/20 bg-state-error/5 px-4 py-3 text-body-sm text-state-error">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={state === 'submitting'}
              className="flex min-h-11 w-full items-center justify-center rounded-control bg-brand-primary px-5 py-3 text-body-sm font-semibold text-surface-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === 'submitting' ? 'Sending...' : 'Send report'}
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
  hint,
  children,
}: {
  label: string
  required?: boolean
  optional?: boolean
  error?: string
  hint?: 'required' | 'email'
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
      {error ? <span className="mt-1 block text-caption text-state-error">{error}</span> : hint && <FieldHint kind={hint} />}
    </label>
  )
}

function inputClass(error?: string): string {
  return `w-full rounded-control border bg-surface-canvas px-3.5 py-2.5 text-base text-ink-primary transition focus:border-brand-accent focus:outline-none ${
    error ? 'border-state-error' : 'border-border'
  }`
}
