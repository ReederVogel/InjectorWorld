'use client'

import { useState } from 'react'
import { MapPin, CheckCircle, WarningCircle } from '@phosphor-icons/react'

export function ZipFeatureRequest() {
  const [zip, setZip] = useState('')
  const [radius, setRadius] = useState('10')
  const [treatment, setTreatment] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{5}$/.test(zip)) {
      setStatus('error')
      setMessage('Enter a valid 5-digit ZIP code.')
      return
    }
    const r = Number(radius)
    if (!Number.isFinite(r) || r < 1 || r > 50) {
      setStatus('error')
      setMessage('Radius must be between 1 and 50 miles.')
      return
    }
    setStatus('submitting')
    setMessage('')
    try {
      const res = await fetch('/api/dashboard/zip-feature-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zip, radiusMiles: r, treatmentName: treatment, notes }),
      })
      const json = await res.json()
      if (!res.ok) {
        setStatus('error')
        setMessage(json.error ?? 'Something went wrong. Please try again.')
      } else {
        setStatus('done')
        setMessage(json.message ?? 'Request submitted.')
        setZip('')
        setRadius('10')
        setTreatment('')
        setNotes('')
      }
    } catch {
      setStatus('error')
      setMessage('Network error. Please try again.')
    }
  }

  return (
    <section className="bg-surface rounded-lg border border-border p-6">
      <div className="flex items-center gap-2 mb-1">
        <MapPin size={20} className="text-brand-accent flex-shrink-0" />
        <h2 className="text-h4 text-ink-primary">Request ZIP featuring</h2>
      </div>
      <p className="text-body-sm text-ink-secondary mb-5">
        Get featured at the top of search results for a specific ZIP code and its
        surrounding area. Our team will review your request and set up the featuring slot.
        Billing is manual for now.
      </p>

      {status === 'done' ? (
        <div className="flex items-start gap-3 p-4 bg-brand-accent-soft rounded-lg text-body-sm text-ink-primary">
          <CheckCircle size={20} className="text-brand-accent flex-shrink-0 mt-0.5" />
          <p>{message}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-body-sm font-medium text-ink-primary mb-1">
                ZIP code <span className="text-state-error">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{5}"
                placeholder="e.g. 10001"
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                required
                className="w-full border border-border rounded-md px-3 py-2 text-body-sm bg-surface-canvas text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
            </div>

            <div>
              <label className="block text-body-sm font-medium text-ink-primary mb-1">
                Radius (miles) <span className="text-state-error">*</span>
              </label>
              <select
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-body-sm bg-surface-canvas text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
              >
                <option value="1">1 mile</option>
                <option value="3">3 miles</option>
                <option value="5">5 miles</option>
                <option value="10">10 miles (recommended)</option>
                <option value="15">15 miles</option>
                <option value="25">25 miles</option>
                <option value="50">50 miles</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-body-sm font-medium text-ink-primary mb-1">
              Treatment (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Botox, Lip Filler (leave blank for all treatments)"
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-body-sm bg-surface-canvas text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
          </div>

          <div>
            <label className="block text-body-sm font-medium text-ink-primary mb-1">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              placeholder="Anything else you want us to know (e.g. preferred start date, budget)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-body-sm bg-surface-canvas text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-accent resize-none"
            />
          </div>

          {status === 'error' && message && (
            <div className="flex items-start gap-2 text-body-sm text-state-error">
              <WarningCircle size={16} className="flex-shrink-0 mt-0.5" />
              <p>{message}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="bg-brand-primary text-surface-canvas px-5 py-2.5 rounded-pill text-body-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {status === 'submitting' ? 'Submitting...' : 'Request ZIP featuring'}
          </button>
        </form>
      )}

      <p className="mt-4 text-caption text-ink-tertiary">
        Our team typically responds within 1 business day. Featuring is sold on a monthly basis.
        Pricing is set per deal.
      </p>
    </section>
  )
}
