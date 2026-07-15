'use client'

import { useState } from 'react'
import { ClinicPhotosUpload, type ClinicPhoto } from './PhotoUpload'
import { can, type Tier } from '@/lib/entitlements'

export type ClinicHoursForm = {
  mon: string
  tue: string
  wed: string
  thu: string
  fri: string
  sat: string
  sun: string
}

export type ClinicFormData = {
  tagline: string
  description: string
  clinicType: string
  serviceType: string
  yearEstablished: number | null
  acceptsInsurance: boolean
  paymentMethods: string
  amenities: string
  phone: string
  email: string
  websiteUrl: string
  bookingUrl: string
  instagramUrl: string
  tiktokUrl: string
  facebookUrl: string
  hours: ClinicHoursForm
  brandsOffered: string[]
  servicesOffered: string[]
  offersVirtualConsult: boolean
  acceptsNewPatients: boolean
  startingPrice: number | null
  languages: string[]
}

export type RelOption = { id: string; name: string }

const CLINIC_TYPES = [
  { value: 'medspa', label: 'Med Spa' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'plastic-surgery', label: 'Plastic Surgery' },
  { value: 'dental-aesthetics', label: 'Dental Aesthetics' },
  { value: 'other', label: 'Other' },
]

const SERVICE_TYPES = ['In-Person', 'Telehealth', 'Both']

const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'zh', label: 'Mandarin' },
  { code: 'yue', label: 'Cantonese' },
  { code: 'ko', label: 'Korean' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ru', label: 'Russian' },
]

const DAYS: { key: keyof ClinicHoursForm; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]

export function ClinicProfileForm({
  initial,
  initialPhotos,
  brandOptions,
  serviceOptions,
  tier = 'free',
  maxPhotos,
}: {
  initial: ClinicFormData
  initialPhotos: ClinicPhoto[]
  brandOptions: RelOption[]
  serviceOptions: RelOption[]
  tier?: Tier
  maxPhotos: number
}) {
  const [form, setForm] = useState<ClinicFormData>(initial)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function set<K extends keyof ClinicFormData>(key: K, value: ClinicFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key]: '' }))
    setSuccess(false)
  }

  function toggleIn(key: 'brandsOffered' | 'servicesOffered' | 'languages', id: string) {
    set(
      key,
      form[key].includes(id) ? form[key].filter((v) => v !== id) : [...form[key], id],
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setFieldErrors({})
    setSuccess(false)

    const body: Record<string, unknown> = {
      tagline: form.tagline,
      description: form.description,
      clinicType: form.clinicType,
      serviceType: form.serviceType,
      yearEstablished: form.yearEstablished,
      acceptsInsurance: form.acceptsInsurance,
      paymentMethods: form.paymentMethods,
      amenities: form.amenities,
      phone: form.phone,
      email: form.email,
      websiteUrl: form.websiteUrl,
      bookingUrl: form.bookingUrl,
      instagramUrl: form.instagramUrl,
      tiktokUrl: form.tiktokUrl,
      facebookUrl: form.facebookUrl,
      hoursJson: form.hours,
      brandsOffered: form.brandsOffered,
      servicesOffered: form.servicesOffered,
      offersVirtualConsult: form.offersVirtualConsult,
      acceptsNewPatients: form.acceptsNewPatients,
      startingPrice: form.startingPrice,
      languages: form.languages,
    }

    try {
      const res = await fetch('/api/dashboard/clinic-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
          {success ? 'Clinic profile updated successfully.' : error}
        </div>
      )}

      {/* About */}
      <section className="space-y-5">
        <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">About your clinic</h2>

        <FormField label="Tagline" error={fieldErrors.tagline}>
          <input
            type="text"
            maxLength={100}
            value={form.tagline}
            onChange={(e) => set('tagline', e.target.value)}
            placeholder="A short line that describes your clinic (max 100 characters)"
            className={inputClass(fieldErrors.tagline)}
          />
        </FormField>

        <FormField label="Description" error={fieldErrors.description}>
          <textarea
            rows={5}
            maxLength={5000}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Tell patients about your clinic, team, and approach."
            className={`${inputClass(fieldErrors.description)} resize-none`}
          />
          <p className="text-caption text-ink-tertiary mt-1">{form.description.length}/5000</p>
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Clinic type" error={fieldErrors.clinicType}>
            <select
              value={form.clinicType}
              onChange={(e) => set('clinicType', e.target.value)}
              className={inputClass(fieldErrors.clinicType)}
            >
              <option value="">Select type…</option>
              {CLINIC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Visit type" error={fieldErrors.serviceType}>
            <select
              value={form.serviceType}
              onChange={(e) => set('serviceType', e.target.value)}
              className={inputClass(fieldErrors.serviceType)}
            >
              {SERVICE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Year established" error={fieldErrors.yearEstablished}>
            <input
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              value={form.yearEstablished ?? ''}
              onChange={(e) => set('yearEstablished', e.target.value === '' ? null : parseInt(e.target.value, 10))}
              placeholder="e.g. 2015"
              className={inputClass(fieldErrors.yearEstablished)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Payment methods" hint="Separate with semicolons" error={fieldErrors.paymentMethods}>
            <input
              type="text"
              maxLength={500}
              value={form.paymentMethods}
              onChange={(e) => set('paymentMethods', e.target.value)}
              placeholder="Credit card; Cash; CareCredit"
              className={inputClass(fieldErrors.paymentMethods)}
            />
          </FormField>
          <FormField label="Amenities" hint="Separate with semicolons" error={fieldErrors.amenities}>
            <input
              type="text"
              maxLength={500}
              value={form.amenities}
              onChange={(e) => set('amenities', e.target.value)}
              placeholder="Free parking; Wheelchair accessible; Wi-Fi"
              className={inputClass(fieldErrors.amenities)}
            />
          </FormField>
        </div>

        <CheckboxRow
          id="acceptsInsurance"
          label="Accepts insurance"
          checked={form.acceptsInsurance}
          onChange={(v) => set('acceptsInsurance', v)}
        />
      </section>

      {/* Photos */}
      <section className="space-y-4">
        <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">Photos</h2>
        <ClinicPhotosUpload initial={initialPhotos} maxPhotos={maxPhotos} />
      </section>

      {/* Hours */}
      <section className="space-y-4">
        <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">Opening hours</h2>
        <p className="text-body-sm text-ink-secondary">
          Use a format like &ldquo;9:00 AM - 5:00 PM&rdquo;. Leave a day blank if you are closed.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DAYS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-24 flex-shrink-0 text-body-sm font-medium text-ink-primary">{label}</span>
              <input
                type="text"
                maxLength={100}
                value={form.hours[key]}
                onChange={(e) => set('hours', { ...form.hours, [key]: e.target.value })}
                placeholder="9:00 AM - 5:00 PM"
                className={inputClass()}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      {serviceOptions.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">Services offered</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {serviceOptions.map((s) => (
              <ToggleChip
                key={s.id}
                label={s.name}
                active={form.servicesOffered.includes(s.id)}
                onClick={() => toggleIn('servicesOffered', s.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Brands */}
      {brandOptions.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">Brands carried</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {brandOptions.map((b) => (
              <ToggleChip
                key={b.id}
                label={b.name}
                active={form.brandsOffered.includes(b.id)}
                onClick={() => toggleIn('brandsOffered', b.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Availability & pricing */}
      <section className="space-y-4">
        <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">Availability and pricing</h2>
        <div className="space-y-3">
          <CheckboxRow
            id="acceptsNewPatients"
            label="Currently accepting new patients"
            checked={form.acceptsNewPatients}
            onChange={(v) => set('acceptsNewPatients', v)}
          />
          <CheckboxRow
            id="offersVirtualConsult"
            label="Offers virtual consultations"
            checked={form.offersVirtualConsult}
            onChange={(v) => set('offersVirtualConsult', v)}
          />
        </div>
        <div className="max-w-xs">
          <FormField label="Starting price shown on cards ($)" error={fieldErrors.startingPrice}>
            <input
              type="number"
              min={0}
              value={form.startingPrice ?? ''}
              onChange={(e) => set('startingPrice', e.target.value === '' ? null : parseFloat(e.target.value))}
              placeholder="e.g. 250"
              className={inputClass(fieldErrors.startingPrice)}
            />
          </FormField>
        </div>
      </section>

      {/* Languages */}
      <section className="space-y-4">
        <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">Languages spoken</h2>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => toggleIn('languages', lang.code)}
              className={`px-4 py-2 rounded-pill text-body-sm font-medium border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 ${
                form.languages.includes(lang.code)
                  ? 'bg-brand-primary text-surface-canvas border-brand-primary'
                  : 'border-border text-ink-secondary hover:border-brand-accent hover:text-ink-primary'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="space-y-5">
        <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">Contact and links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Phone" error={fieldErrors.phone}>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="(555) 000-0000"
              className={inputClass(fieldErrors.phone)}
            />
          </FormField>
          <FormField label="Contact email" error={fieldErrors.email}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="hello@yourclinic.com"
              className={inputClass(fieldErrors.email)}
            />
          </FormField>
          <FormField label="Website URL" error={fieldErrors.websiteUrl}>
            <input
              type="url"
              value={form.websiteUrl}
              onChange={(e) => set('websiteUrl', e.target.value)}
              placeholder="https://yourclinic.com"
              className={inputClass(fieldErrors.websiteUrl)}
            />
          </FormField>
          <FormField label="Online booking URL" error={fieldErrors.bookingUrl}>
            <input
              type="url"
              value={form.bookingUrl}
              onChange={(e) => set('bookingUrl', e.target.value)}
              placeholder="https://yourclinic.com/book"
              className={inputClass(fieldErrors.bookingUrl)}
            />
          </FormField>
          {can(tier, 'socialLinks') ? (
            <>
              <FormField label="Instagram URL" error={fieldErrors.instagramUrl}>
                <input
                  type="url"
                  value={form.instagramUrl}
                  onChange={(e) => set('instagramUrl', e.target.value)}
                  placeholder="https://instagram.com/yourclinic"
                  className={inputClass(fieldErrors.instagramUrl)}
                />
              </FormField>
              <FormField label="TikTok URL" error={fieldErrors.tiktokUrl}>
                <input
                  type="url"
                  value={form.tiktokUrl}
                  onChange={(e) => set('tiktokUrl', e.target.value)}
                  placeholder="https://tiktok.com/@yourclinic"
                  className={inputClass(fieldErrors.tiktokUrl)}
                />
              </FormField>
              <FormField label="Facebook URL" error={fieldErrors.facebookUrl}>
                <input
                  type="url"
                  value={form.facebookUrl}
                  onChange={(e) => set('facebookUrl', e.target.value)}
                  placeholder="https://facebook.com/yourclinic"
                  className={inputClass(fieldErrors.facebookUrl)}
                />
              </FormField>
            </>
          ) : (
            <LockedField label="Instagram, TikTok and Facebook links" upgradeLabel="Starter" />
          )}
        </div>
      </section>

      {/* Read-only section */}
      <section className="rounded-xl border border-border-subtle bg-surface p-5 space-y-3">
        <h3 className="text-body-sm font-semibold text-ink-primary">Fields managed by injector.world</h3>
        <p className="text-body-sm text-ink-secondary">
          Clinic name, address, aggregate rating, and reviews are managed by our editorial team and cannot be changed here. Contact{' '}
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
          className="bg-brand-primary text-surface-canvas rounded-pill px-8 py-3 text-body-sm font-semibold hover:opacity-90 transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2"
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

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 rounded-lg text-body-sm font-medium border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 ${
        active
          ? 'bg-brand-accent-soft border-brand-accent text-brand-primary'
          : 'border-border text-ink-secondary hover:border-brand-accent hover:text-ink-primary'
      }`}
    >
      {label}
    </button>
  )
}

function LockedField({ label, upgradeLabel }: { label: string; upgradeLabel: string }) {
  return (
    <div className="sm:col-span-2 flex items-center gap-3 px-4 py-3.5 rounded-md border border-dashed border-border bg-surface text-body-sm text-ink-tertiary">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-ink-tertiary">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
      <span>
        {label}{' '}
        <a href="/pricing" className="text-brand-accent hover:underline font-medium">
          Upgrade to {upgradeLabel} to unlock
        </a>
      </span>
    </div>
  )
}
