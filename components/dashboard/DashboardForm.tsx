'use client'

import { useState } from 'react'
import { ProviderHeadshotUpload } from './PhotoUpload'

export type DashboardFormData = {
  tagline: string
  bio: string
  languages: string[]
  treatmentsOffered: string[] // treatment IDs
  pricingBotoxPerUnit: number | null
  pricingFillerPerSyringe: number | null
  pricingConsultation: number | null
  startingPrice: number | null
  acceptsNewPatients: boolean
  offersVirtualConsult: boolean
  offersInPerson: boolean
  websiteUrl: string
  email: string
  phoneDirect: string
  instagramUrl: string
  tiktokUrl: string
  linkedinUrl: string
}

export type TreatmentOption = { id: string; name: string }

const ALL_LANGUAGES = [
  'English', 'Spanish', 'Mandarin', 'Korean', 'Hindi', 'Russian',
  'French', 'Portuguese', 'Arabic', 'Vietnamese',
]

export function DashboardForm({
  initial,
  initialPhotoUrl,
  treatmentOptions,
  providerName,
}: {
  initial: DashboardFormData
  initialPhotoUrl?: string
  treatmentOptions: TreatmentOption[]
  providerName: string
}) {
  const [form, setForm] = useState<DashboardFormData>(initial)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function set<K extends keyof DashboardFormData>(key: K, value: DashboardFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key]: '' }))
    setSuccess(false)
  }

  function toggleLanguage(lang: string) {
    set(
      'languages',
      form.languages.includes(lang)
        ? form.languages.filter((l) => l !== lang)
        : [...form.languages, lang],
    )
  }

  function toggleTreatment(id: string) {
    set(
      'treatmentsOffered',
      form.treatmentsOffered.includes(id)
        ? form.treatmentsOffered.filter((t) => t !== id)
        : [...form.treatmentsOffered, id],
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setFieldErrors({})
    setSuccess(false)

    try {
      const res = await fetch('/api/dashboard/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        credentials: 'include',
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (data.fieldErrors) setFieldErrors(data.fieldErrors)
        else setError(data.error || 'Could not save changes.')
        setSaving(false)
        return
      }

      setSuccess(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-10">

      {/* Status bar */}
      {(success || error) && (
        <div className={`px-4 py-3 rounded-xl text-body-sm font-medium ${
          success
            ? 'bg-brand-accent-soft text-brand-accent border border-brand-accent/30'
            : 'bg-[#B91C1C]/5 text-[#B91C1C] border border-[#B91C1C]/20'
        }`}>
          {success ? 'Profile updated successfully.' : error}
        </div>
      )}

      {/* Profile */}
      <section className="space-y-5">
        <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">Profile</h2>

        <FormField label="Tagline" error={fieldErrors.tagline}>
          <input
            type="text"
            maxLength={100}
            value={form.tagline}
            onChange={(e) => set('tagline', e.target.value)}
            placeholder="A short line that describes your approach (max 100 characters)"
            className={inputClass(fieldErrors.tagline)}
          />
        </FormField>

        <FormField label="Bio" error={fieldErrors.bio}>
          <textarea
            rows={5}
            maxLength={3000}
            value={form.bio}
            onChange={(e) => set('bio', e.target.value)}
            placeholder="Tell patients about your training, philosophy, and approach."
            className={`${inputClass(fieldErrors.bio)} resize-none`}
          />
          <p className="text-caption text-ink-tertiary mt-1">{form.bio.length}/3000</p>
        </FormField>

        <ProviderHeadshotUpload initialUrl={initialPhotoUrl} />
      </section>

      {/* Availability */}
      <section className="space-y-4">
        <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">Availability</h2>

        <div className="space-y-3">
          <CheckboxRow
            id="acceptsNewPatients"
            label="Currently accepting new patients"
            checked={form.acceptsNewPatients}
            onChange={(v) => set('acceptsNewPatients', v)}
          />
          <CheckboxRow
            id="offersInPerson"
            label="Offers in-person appointments"
            checked={form.offersInPerson}
            onChange={(v) => set('offersInPerson', v)}
          />
          <CheckboxRow
            id="offersVirtualConsult"
            label="Offers virtual consultations"
            checked={form.offersVirtualConsult}
            onChange={(v) => set('offersVirtualConsult', v)}
          />
        </div>
      </section>

      {/* Languages */}
      <section className="space-y-4">
        <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">Languages</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => toggleLanguage(lang)}
              className={`px-4 py-2 rounded-pill text-body-sm font-medium border transition ${
                form.languages.includes(lang)
                  ? 'bg-brand-primary text-surface-canvas border-brand-primary'
                  : 'border-border text-ink-secondary hover:border-brand-accent hover:text-ink-primary'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </section>

      {/* Treatments */}
      {treatmentOptions.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">Treatments offered</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {treatmentOptions.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTreatment(t.id)}
                className={`px-4 py-2.5 rounded-lg text-body-sm font-medium border text-left transition ${
                  form.treatmentsOffered.includes(t.id)
                    ? 'bg-brand-accent-soft border-brand-accent text-brand-primary'
                    : 'border-border text-ink-secondary hover:border-brand-accent hover:text-ink-primary'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Pricing */}
      <section className="space-y-5">
        <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">Pricing</h2>
        <p className="text-body-sm text-ink-secondary">
          Prices are shown as estimates to patients. Leave blank to hide a row.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberField
            label="Botox per unit ($)"
            value={form.pricingBotoxPerUnit}
            onChange={(v) => set('pricingBotoxPerUnit', v)}
            error={fieldErrors.pricingBotoxPerUnit}
            placeholder="e.g. 14"
          />
          <NumberField
            label="Filler per syringe ($)"
            value={form.pricingFillerPerSyringe}
            onChange={(v) => set('pricingFillerPerSyringe', v)}
            error={fieldErrors.pricingFillerPerSyringe}
            placeholder="e.g. 750"
          />
          <NumberField
            label="Consultation ($, enter 0 for free)"
            value={form.pricingConsultation}
            onChange={(v) => set('pricingConsultation', v)}
            error={fieldErrors.pricingConsultation}
            placeholder="e.g. 0"
          />
          <NumberField
            label="Starting price shown on cards ($)"
            value={form.startingPrice}
            onChange={(v) => set('startingPrice', v)}
            error={fieldErrors.startingPrice}
            placeholder="e.g. 500"
          />
        </div>
      </section>

      {/* Contact */}
      <section className="space-y-5">
        <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">Contact and links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Website URL" error={fieldErrors.websiteUrl}>
            <input
              type="url"
              value={form.websiteUrl}
              onChange={(e) => set('websiteUrl', e.target.value)}
              placeholder="https://yourwebsite.com"
              className={inputClass(fieldErrors.websiteUrl)}
            />
          </FormField>
          <FormField label="Booking / contact email" error={fieldErrors.email}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="bookings@yourpractice.com"
              className={inputClass(fieldErrors.email)}
            />
          </FormField>
          <FormField label="Direct phone" error={fieldErrors.phoneDirect}>
            <input
              type="tel"
              value={form.phoneDirect}
              onChange={(e) => set('phoneDirect', e.target.value)}
              placeholder="(555) 000-0000"
              className={inputClass(fieldErrors.phoneDirect)}
            />
          </FormField>
          <FormField label="Instagram URL" error={fieldErrors.instagramUrl}>
            <input
              type="url"
              value={form.instagramUrl}
              onChange={(e) => set('instagramUrl', e.target.value)}
              placeholder="https://instagram.com/yourhandle"
              className={inputClass(fieldErrors.instagramUrl)}
            />
          </FormField>
          <FormField label="TikTok URL" error={fieldErrors.tiktokUrl}>
            <input
              type="url"
              value={form.tiktokUrl}
              onChange={(e) => set('tiktokUrl', e.target.value)}
              placeholder="https://tiktok.com/@yourhandle"
              className={inputClass(fieldErrors.tiktokUrl)}
            />
          </FormField>
          <FormField label="LinkedIn URL" error={fieldErrors.linkedinUrl}>
            <input
              type="url"
              value={form.linkedinUrl}
              onChange={(e) => set('linkedinUrl', e.target.value)}
              placeholder="https://linkedin.com/in/yourprofile"
              className={inputClass(fieldErrors.linkedinUrl)}
            />
          </FormField>
        </div>
      </section>

      {/* Read-only section */}
      <section className="rounded-xl border border-border-subtle bg-surface p-5 space-y-3">
        <h3 className="text-body-sm font-semibold text-ink-primary">Fields managed by injector.world</h3>
        <p className="text-body-sm text-ink-secondary">
          License number, NPI, verified badge, aggregate rating, and reviews are managed by our editorial team and cannot be changed here. Contact{' '}
          <a href="mailto:support@injector.world" className="text-brand-accent hover:underline">
            support@injector.world
          </a>{' '}
          for corrections.
        </p>
      </section>

      {/* Save */}
      <div className="flex items-center justify-end gap-4 pt-2">
        {success && (
          <span className="text-body-sm text-brand-accent font-medium">Saved.</span>
        )}
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-primary text-surface-canvas rounded-pill px-8 py-3 text-body-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

function inputClass(error?: string) {
  return `w-full px-4 py-3 rounded-md border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body-sm ${
    error ? 'border-[#B91C1C]' : 'border-border'
  }`
}

function FormField({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-body-sm font-medium text-ink-primary mb-1.5">{label}</label>
      {hint && <p className="text-caption text-ink-tertiary mb-1.5">{hint}</p>}
      {children}
      {error && <p className="text-caption text-[#B91C1C] mt-1">{error}</p>}
    </div>
  )
}

function CheckboxRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 cursor-pointer group">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-border text-brand-accent accent-brand-accent"
      />
      <span className="text-body-sm text-ink-secondary group-hover:text-ink-primary transition">
        {label}
      </span>
    </label>
  )
}

function NumberField({
  label,
  value,
  onChange,
  error,
  placeholder,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  error?: string
  placeholder?: string
}) {
  return (
    <FormField label={label} error={error}>
      <input
        type="number"
        min={0}
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value
          onChange(v === '' ? null : parseFloat(v))
        }}
        placeholder={placeholder}
        className={inputClass(error)}
      />
    </FormField>
  )
}
