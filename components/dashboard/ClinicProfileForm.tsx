'use client'

import { useEffect, useRef, useState } from 'react'
import { ClinicPhotosUpload, type ClinicPhoto } from './PhotoUpload'
import { SignedOutNotice } from './SignedOutNotice'
import { can, type Tier } from '@/lib/entitlements'
import { parseRange } from '@/components/clinics/ClinicHoursBar'

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
  acceptsInsurance: boolean
  paymentMethods: string
  amenities: string
  phone: string
  email: string
  emailPublic: boolean
  websiteUrl: string
  instagramUrl: string
  tiktokUrl: string
  facebookUrl: string
  linkedinUrl: string
  youtubeUrl: string
  hours: ClinicHoursForm
  brandsOffered: string[]
  servicesOffered: string[]
  startingPrice: number | null
}

export type RelOption = { id: string; name: string }

const CLINIC_TYPES = [
  { value: 'medspa', label: 'Med Spa' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'plastic-surgery', label: 'Plastic Surgery' },
  { value: 'dental-aesthetics', label: 'Dental Aesthetics' },
  { value: 'other', label: 'Other' },
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

// Chip options use the wording imported (Google) data already has, so existing
// values show as ticked. Anything else goes in the "Other" box.
const PAYMENT_OPTIONS = ['Credit cards', 'Debit cards', 'NFC mobile payments', 'Cash', 'Checks', 'Payment plans', 'CareCredit', 'Cherry', 'Affirm', 'HSA/FSA', 'Aspire Galderma Rewards']
const AMENITY_OPTIONS = [
  'Wheelchair accessible entrance', 'Wheelchair accessible parking lot', 'Wheelchair accessible restroom', 'Restroom',
  'Free parking lot', 'Free street parking', 'On-site parking', 'Appointment required', 'Appointments recommended',
  'Online scheduling', 'Onsite services', 'Membership', 'Language assistance', 'LGBTQ+ friendly', 'Identifies as women-owned',
]

/** Jump links at the top of the form; the onboarding checklist links to the same ids. */
const SECTIONS = [
  { id: 'photos', label: 'Photos' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
  { id: 'hours', label: 'Hours' },
  { id: 'services', label: 'Services' },
  { id: 'brands', label: 'Brands' },
  { id: 'practice', label: 'Practice notes' },
  { id: 'pricing', label: 'Pricing' },
]

const FIELD_LABELS: Record<string, string> = {
  tagline: 'Tagline',
  description: 'Description',
  clinicType: 'Clinic type',
  acceptsInsurance: 'Accepts insurance',
  paymentMethods: 'Payment methods',
  amenities: 'Amenities',
  phone: 'Phone',
  email: 'Contact email',
  emailPublic: 'Show email',
  websiteUrl: 'Website URL',
  instagramUrl: 'Instagram URL',
  tiktokUrl: 'TikTok URL',
  facebookUrl: 'Facebook URL',
  linkedinUrl: 'LinkedIn URL',
  youtubeUrl: 'YouTube URL',
  hoursJson: 'Opening hours',
  brandsOffered: 'Brands carried',
  servicesOffered: 'Services offered',
  startingPrice: 'Starting price',
}

/** The save body for a form state, keyed the way /api/dashboard/clinic-save expects. */
function toBody(f: ClinicFormData): Record<string, unknown> {
  const { hours, ...rest } = f
  return { ...rest, hoursJson: hours }
}

// Edits kept in this browser when a save finds the owner signed out, restored on return.
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000
const draftKey = (clinicId: number) => `iw-clinic-draft-${clinicId}`

function readDraft(clinicId: number): ClinicFormData | null {
  try {
    const d = JSON.parse(localStorage.getItem(draftKey(clinicId)) || 'null')
    return d?.form && Date.now() - d.savedAt < DRAFT_TTL_MS ? (d.form as ClinicFormData) : null
  } catch {
    return null
  }
}

function writeDraft(clinicId: number, form: ClinicFormData | null) {
  try {
    if (form) localStorage.setItem(draftKey(clinicId), JSON.stringify({ savedAt: Date.now(), form }))
    else localStorage.removeItem(draftKey(clinicId))
  } catch {
    /* storage blocked (private mode): nothing to keep */
  }
}

type Status = { kind: 'success' | 'error' | 'info'; text: string } | { kind: 'signedOut' } | null

export function ClinicProfileForm({
  clinicId,
  initial,
  initialPhotos,
  brandOptions,
  serviceOptions,
  tier = 'free',
  maxPhotos,
}: {
  clinicId: number
  initial: ClinicFormData
  initialPhotos: ClinicPhoto[]
  brandOptions: RelOption[]
  serviceOptions: RelOption[]
  tier?: Tier
  maxPhotos: number
}) {
  const [form, setForm] = useState<ClinicFormData>(initial)
  // What the server last accepted. Save sends only fields that differ from it.
  const [baseline, setBaseline] = useState<ClinicFormData>(initial)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [restored, setRestored] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const dirty = JSON.stringify(toBody(form)) !== JSON.stringify(toBody(baseline))

  // Warn before leaving with unsaved edits. Not after a sign-out: those edits are
  // already kept in this browser, and the sign-in link must not nag.
  useEffect(() => {
    if (!dirty || status?.kind === 'signedOut') return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, status])

  useEffect(() => {
    const draft = readDraft(clinicId)
    if (draft) {
      setForm(draft)
      setRestored(true)
    }
  }, [clinicId])

  function set<K extends keyof ClinicFormData>(key: K, value: ClinicFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key]: '' }))
    setStatus(null)
  }

  function toggleIn(key: 'brandsOffered' | 'servicesOffered', id: string) {
    set(
      key,
      form[key].includes(id) ? form[key].filter((v) => v !== id) : [...form[key], id],
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    setStatus(null)

    // Only the fields the owner changed. Imported values they never touched
    // (a few fail today's validation) must not block saving something else.
    const now = toBody(form)
    const before = toBody(baseline)
    const body = Object.fromEntries(
      Object.entries(now).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k])),
    )
    if (Object.keys(body).length === 0) {
      setStatus({ kind: 'info', text: 'No changes to save.' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/dashboard/clinic-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })

      const data = await res.json().catch(() => ({}))

      if (res.status === 401) {
        writeDraft(clinicId, form)
        setStatus({ kind: 'signedOut' })
        return
      }
      if (!res.ok) {
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors)
          const names = Object.keys(data.fieldErrors).map((k) => FIELD_LABELS[k] ?? k)
          setStatus({ kind: 'error', text: `Please check: ${names.join(', ')}.` })
          requestAnimationFrame(() =>
            formRef.current?.querySelector('[data-field-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
          )
        } else {
          setStatus({ kind: 'error', text: data.error || 'Could not save changes.' })
        }
        return
      }

      setBaseline(form)
      setLastSaved(new Date())
      writeDraft(clinicId, null)
      setRestored(false)
      setStatus({ kind: 'success', text: 'Saved. Your public page updates within a few minutes.' })
    } catch {
      setStatus({ kind: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSave} className="space-y-10">

      {restored && (
        <p className="px-4 py-3 rounded-xl text-body-sm bg-brand-accent-soft text-brand-primary border border-brand-accent/30">
          We brought back the changes you had not saved yet. Review them, then click Save changes.
        </p>
      )}

      <nav aria-label="Profile sections" className="-mt-2 flex gap-2 overflow-x-auto pb-1">
        {SECTIONS.filter((s) => (s.id !== 'services' || serviceOptions.length) && (s.id !== 'brands' || brandOptions.length)).map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="shrink-0 rounded-control border border-border px-3 py-1.5 text-body-sm text-ink-secondary transition hover:border-ink-secondary hover:text-ink-primary"
          >
            {s.label}
          </a>
        ))}
      </nav>

      {/* Photos — same position as the cover photo/gallery at the top of the public page */}
      <section id="photos" className="space-y-4 scroll-mt-28">
        <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">Photos</h2>
        <ClinicPhotosUpload initial={initialPhotos} maxPhotos={maxPhotos} />
      </section>

      {/* About — name/tagline/description sits right under the photo on the public page */}
      <section id="about" className="space-y-5 scroll-mt-28">
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

        <div className="max-w-xs">
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
        </div>
      </section>

      {/* Contact and links — hero block on the public page shows address/phone/website/hours together */}
      <section id="contact" className="space-y-5 scroll-mt-28">
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
          {/* Email is the one contact detail that stays private by default.
              Phone, website and social are public on every profile; a scraped
              email is only published once the owner ticks this. */}
          <label className="flex cursor-pointer items-start gap-2.5 rounded-control border border-border bg-surface p-3.5">
            <input
              type="checkbox"
              checked={form.emailPublic}
              onChange={(e) => set('emailPublic', e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#0B1B34]"
            />
            <span>
              <span className="block text-body-sm font-semibold text-ink-primary">
                Show this email on your public profile
              </span>
              <span className="block text-caption text-ink-secondary">
                Off by default. Your phone, website and social links are always public.
              </span>
            </span>
          </label>
          <FormField label="Website URL" error={fieldErrors.websiteUrl}>
            <input
              type="url"
              value={form.websiteUrl}
              onChange={(e) => set('websiteUrl', e.target.value)}
              placeholder="https://yourclinic.com"
              className={inputClass(fieldErrors.websiteUrl)}
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
              <FormField label="LinkedIn URL" error={fieldErrors.linkedinUrl}>
                <input
                  type="url"
                  value={form.linkedinUrl}
                  onChange={(e) => set('linkedinUrl', e.target.value)}
                  placeholder="https://linkedin.com/company/yourclinic"
                  className={inputClass(fieldErrors.linkedinUrl)}
                />
              </FormField>
              <FormField label="YouTube URL" error={fieldErrors.youtubeUrl}>
                <input
                  type="url"
                  value={form.youtubeUrl}
                  onChange={(e) => set('youtubeUrl', e.target.value)}
                  placeholder="https://youtube.com/@yourclinic"
                  className={inputClass(fieldErrors.youtubeUrl)}
                />
              </FormField>
            </>
          ) : (
            <LockedField label="Instagram, TikTok, Facebook, LinkedIn and YouTube links" upgradeLabel="Starter" />
          )}
        </div>
      </section>

      {/* Hours */}
      <section id="hours" className="space-y-4 scroll-mt-28">
        <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">Opening hours</h2>
        <HoursEditor hours={form.hours} onChange={(h) => set('hours', h)} />
        {fieldErrors.hoursJson && <p data-field-error className="text-caption text-[#B91C1C]">{fieldErrors.hoursJson}</p>}
      </section>

      {/* Services */}
      {serviceOptions.length > 0 && (
        <section id="services" className="space-y-4 scroll-mt-28">
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
        <section id="brands" className="space-y-4 scroll-mt-28">
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

      {/* Practice notes — matches the "Practice notes" block on the public page (amenities, payment, insurance) */}
      <section id="practice" className="space-y-6 scroll-mt-28">
        <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">Practice notes</h2>
        {/* key: remount after a draft restore so the "Other" boxes pick up the restored text */}
        <FormField label="Payment methods" error={fieldErrors.paymentMethods}>
          <ListChips key={`pay-${restored}`} label="Other payment methods" options={PAYMENT_OPTIONS} value={form.paymentMethods} onChange={(v) => set('paymentMethods', v)} />
        </FormField>
        <FormField label="Amenities" error={fieldErrors.amenities}>
          <ListChips key={`amen-${restored}`} label="Other amenities" options={AMENITY_OPTIONS} value={form.amenities} onChange={(v) => set('amenities', v)} />
        </FormField>
        <CheckboxRow
          id="acceptsInsurance"
          label="Accepts insurance"
          checked={form.acceptsInsurance}
          onChange={(v) => set('acceptsInsurance', v)}
        />
      </section>

      {/* Pricing — not shown on the clinic detail page, but drives the price shown on directory listing cards */}
      <section id="pricing" className="space-y-4 scroll-mt-28">
        <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">Pricing</h2>
        <div className="max-w-xs">
          <FormField label="Starting price shown on listing cards ($)" error={fieldErrors.startingPrice}>
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

      {/* Save. Sticks to the bottom of the screen: the form is long, and Save and
          its messages must never be a scroll away. */}
      {status?.kind === 'signedOut' && <SignedOutNotice keptEdits />}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-border bg-surface-canvas py-3">
        <p
          role="status"
          className={`text-body-sm font-medium ${
            status?.kind === 'success' ? 'text-brand-accent' : status?.kind === 'error' ? 'text-[#B91C1C]' : 'text-ink-secondary'
          }`}
        >
          {status && status.kind !== 'signedOut'
            ? status.text
            : dirty
              ? 'Unsaved changes'
              : lastSaved
                ? `Last saved at ${lastSaved.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : ''}
        </p>
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-primary text-surface-canvas rounded-control px-8 py-3 text-body-sm font-semibold hover:opacity-90 transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

// 16px text on phones: anything smaller makes iOS zoom the page on focus.
function inputClass(error?: string) {
  return `w-full px-4 py-3 rounded-md border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body sm:text-body-sm ${
    error ? 'border-[#B91C1C]' : 'border-border'
  }`
}

const selectClass =
  'rounded-md border border-border bg-surface-canvas px-3 py-2.5 text-body sm:text-body-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-accent'

const TIMES = Array.from({ length: 96 }, (_, i) => i * 15) // every 15 minutes, as minutes from midnight
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const clock = (m: number) => {
  const h = Math.floor(m / 60)
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

/**
 * Per-day Open/Closed with time pickers. Writes "HH:MM-HH:MM" or "closed", the
 * shape imported clinics use and schema.org openingHours accepts; free text such
 * as "9 AM - 5 PM" used to go into the schema as typed. A value it cannot read
 * (e.g. "By appointment") stays as listed until the owner picks Open or Closed.
 */
function HoursEditor({ hours, onChange }: { hours: ClinicHoursForm; onChange: (h: ClinicHoursForm) => void }) {
  const setDay = (key: keyof ClinicHoursForm, value: string) => onChange({ ...hours, [key]: value })
  const timeOptions = (current: number) => (TIMES.includes(current) ? TIMES : [...TIMES, current].sort((a, b) => a - b))

  return (
    <div className="space-y-2.5">
      {DAYS.map(({ key, label }) => {
        const raw = hours[key].trim()
        const closed = !raw || /^closed$/i.test(raw)
        const range = closed ? null : parseRange(raw)
        const mode = closed ? 'closed' : range ? 'open' : 'custom'
        return (
          <div key={key} className="flex flex-wrap items-center gap-2">
            <span className="w-24 shrink-0 text-body-sm font-medium text-ink-primary">{label}</span>
            <select
              aria-label={`${label}: open or closed`}
              value={mode}
              onChange={(e) => setDay(key, e.target.value === 'closed' ? 'closed' : e.target.value === 'open' ? '09:00-17:00' : raw)}
              className={selectClass}
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              {mode === 'custom' && <option value="custom">As listed: {raw}</option>}
            </select>
            {range && (
              <>
                <select aria-label={`${label} opens at`} value={range.open} onChange={(e) => setDay(key, `${hhmm(Number(e.target.value))}-${hhmm(range.close)}`)} className={selectClass}>
                  {timeOptions(range.open).map((m) => <option key={m} value={m}>{clock(m)}</option>)}
                </select>
                <span className="text-body-sm text-ink-secondary">to</span>
                <select aria-label={`${label} closes at`} value={range.close} onChange={(e) => setDay(key, `${hhmm(range.open)}-${hhmm(Number(e.target.value))}`)} className={selectClass}>
                  {timeOptions(range.close).map((m) => <option key={m} value={m}>{clock(m)}</option>)}
                </select>
              </>
            )}
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => onChange({ ...hours, tue: hours.mon, wed: hours.mon, thu: hours.mon, fri: hours.mon })}
        className="text-body-sm font-medium text-ink-secondary underline hover:text-ink-primary"
      >
        Copy Monday to Tuesday through Friday
      </button>
    </div>
  )
}

const splitList = (value: string) => value.split(/[;,]/).map((s) => s.trim()).filter(Boolean)

/** Tick chips for the common values, plus an "Other" box. Saved as one "; "-separated string, as before. */
function ListChips({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  const items = splitList(value)
  const has = (o: string) => items.some((i) => i.toLowerCase() === o.toLowerCase())
  const selected = options.filter(has)
  const [other, setOther] = useState(() => items.filter((i) => !options.some((o) => o.toLowerCase() === i.toLowerCase())).join('; '))
  const emit = (sel: string[], otherText: string) => onChange([...sel, otherText.trim()].filter(Boolean).join('; '))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <ToggleChip
            key={o}
            label={o}
            active={selected.includes(o)}
            onClick={() => emit(options.filter((x) => (x === o ? !selected.includes(o) : selected.includes(x))), other)}
          />
        ))}
      </div>
      <input
        type="text"
        aria-label={label}
        value={other}
        onChange={(e) => {
          setOther(e.target.value)
          emit(selected, e.target.value)
        }}
        placeholder="Anything else, separated by semicolons"
        className={inputClass()}
      />
    </div>
  )
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
      {error && <p data-field-error className="text-caption text-[#B91C1C] mt-1">{error}</p>}
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
