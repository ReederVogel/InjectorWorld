'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSaved } from './SavedItemsProvider'
import { LogoutButton } from '@/components/auth/LogoutButton'

export type ProfileData = {
  user: { name: string; email: string }
  savedProviders: { id: string; name: string; credentials: string; slug: string; photoUrl: string }[]
  savedClinics: { id: string; name: string; slug: string; location: string }[]
  bookings: { id: string; providerName: string; treatment: string; preferredDate: string; status: string; createdAt: string }[]
  questions: { id: string; title: string; status: string; slug: string; answered: boolean }[]
  recommended: { name: string; slug: string } | null
}

function fmtDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const BOOKING_STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: 'Requested', cls: 'bg-[#1E40AF]/10 text-[#1E40AF]' },
  confirmed: { label: 'Confirmed', cls: 'bg-brand-accent-soft text-brand-accent' },
  completed: { label: 'Completed', cls: 'bg-brand-accent-soft text-brand-accent' },
  cancelled: { label: 'Cancelled', cls: 'bg-ink-tertiary/15 text-ink-secondary' },
  no_show: { label: 'No-show', cls: 'bg-ink-tertiary/15 text-ink-secondary' },
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-surface p-5 md:p-6">{children}</div>
}

function NameForm({ initialName, email }: { initialName: string; email: string }) {
  const [name, setName] = useState(initialName)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/account/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Could not save.')
      } else {
        setEditing(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } catch {
      setError('Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-caption uppercase tracking-wide text-ink-tertiary mb-1">Name</p>
        {editing ? (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-md border border-border bg-surface-canvas text-ink-primary text-body-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving || !name.trim()}
                className="px-4 py-2.5 rounded-pill bg-brand-primary text-surface-canvas text-body-sm font-semibold hover:opacity-90 transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setName(initialName)
                  setEditing(false)
                  setError('')
                }}
                className="px-4 py-2.5 rounded-pill border border-border text-ink-secondary text-body-sm hover:text-ink-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-body text-ink-primary">{name || 'Not set'}</p>
            <button onClick={() => setEditing(true)} className="text-body-sm text-brand-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2">
              Edit
            </button>
          </div>
        )}
        {error && <p className="text-caption text-[#B91C1C] mt-1.5">{error}</p>}
        {saved && <p className="text-caption text-brand-accent mt-1.5">Saved.</p>}
      </div>

      <div>
        <p className="text-caption uppercase tracking-wide text-ink-tertiary mb-1">Email</p>
        <p className="text-body text-ink-secondary">{email}</p>
      </div>
    </div>
  )
}

export function ProfileClient({ data }: { data: ProfileData }) {
  const { toggle } = useSaved()
  const [providers, setProviders] = useState(data.savedProviders)
  const [clinics, setClinics] = useState(data.savedClinics)

  function unsaveProvider(id: string) {
    setProviders((prev) => prev.filter((p) => p.id !== id))
    toggle('provider', id)
  }
  function unsaveClinic(id: string) {
    setClinics((prev) => prev.filter((c) => c.id !== id))
    toggle('clinic', id)
  }

  const firstName = data.user.name?.split(' ')[0] || 'there'

  return (
    <div className="max-canvas py-10 md:py-14">
      {/* Heading */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <p className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-2">Your account</p>
          <h1 className="font-serif text-h1 text-ink-primary">Welcome back, {firstName}</h1>
        </div>
        <LogoutButton className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-pill border border-border text-body-sm text-ink-secondary hover:text-ink-primary transition">
          Sign out
        </LogoutButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Saved providers */}
          <div>
            <h2 className="font-serif text-h3 text-ink-primary mb-3">Saved injectors</h2>
            {providers.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-ink-secondary">No saved providers yet.</p>
                <Link href="/injectors" className="mt-4 inline-block text-brand-accent hover:underline text-sm">
                  Browse providers
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {providers.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-border bg-surface p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-surface-canvas border border-border overflow-hidden flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.photoUrl ? <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/injectors/${p.slug}`} className="block text-body-sm font-semibold text-ink-primary hover:text-brand-accent truncate">
                        {p.name}
                      </Link>
                      {p.credentials && <p className="text-caption text-ink-tertiary truncate">{p.credentials}</p>}
                    </div>
                    <button
                      onClick={() => unsaveProvider(p.id)}
                      aria-label="Remove from saved"
                      className="flex-shrink-0 p-2 text-brand-accent hover:text-ink-secondary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Saved clinics */}
          <div>
            <h2 className="font-serif text-h3 text-ink-primary mb-3">Saved clinics</h2>
            {clinics.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-ink-secondary">No saved clinics yet.</p>
                <Link href="/clinics" className="mt-4 inline-block text-brand-accent hover:underline text-sm">
                  Browse clinics
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {clinics.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-border bg-surface p-4 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/clinics/${c.slug}`} className="block text-body-sm font-semibold text-ink-primary hover:text-brand-accent truncate">
                        {c.name}
                      </Link>
                      {c.location && <p className="text-caption text-ink-tertiary truncate">{c.location}</p>}
                    </div>
                    <button
                      onClick={() => unsaveClinic(c.id)}
                      aria-label="Remove from saved"
                      className="flex-shrink-0 p-2 text-brand-accent hover:text-ink-secondary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Consult requests */}
          <div>
            <h2 className="font-serif text-h3 text-ink-primary mb-3">Your consult requests</h2>
            {data.bookings.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-ink-secondary">No consult requests yet.</p>
                <Link href="/injectors" className="mt-4 inline-block text-brand-accent hover:underline text-sm">
                  Browse providers to book a consult
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {data.bookings.map((b) => {
                  const s = BOOKING_STATUS[b.status] || BOOKING_STATUS.new
                  return (
                    <SectionCard key={b.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-body-sm font-semibold text-ink-primary">
                            {b.providerName || 'Consult request'}
                          </p>
                          <p className="text-caption text-ink-tertiary mt-0.5">
                            {b.treatment ? `${b.treatment} · ` : ''}Requested {fmtDate(b.createdAt)}
                            {b.preferredDate ? ` · Preferred ${fmtDate(b.preferredDate)}` : ''}
                          </p>
                        </div>
                        <span className={`flex-shrink-0 text-caption font-medium px-2.5 py-1 rounded-pill ${s.cls}`}>
                          {s.label}
                        </span>
                      </div>
                    </SectionCard>
                  )
                })}
                <p className="text-caption text-ink-tertiary">
                  A request is not a confirmed appointment until the provider reaches out.
                </p>
              </div>
            )}
          </div>

          {/* My questions */}
          <div>
            <h2 className="font-serif text-h3 text-ink-primary mb-3">Your questions</h2>
            {data.questions.length === 0 ? (
              <SectionCard>
                <p className="text-body-sm text-ink-secondary">
                  You have not asked anything yet.{' '}
                  <Link href="/questions" className="text-brand-accent hover:underline">Browse the Q&amp;A board</Link>.
                </p>
              </SectionCard>
            ) : (
              <div className="space-y-3">
                {data.questions.map((q) => (
                  <SectionCard key={q.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {q.answered && q.slug ? (
                          <Link href={`/questions/${q.slug}`} className="text-body-sm font-semibold text-ink-primary hover:text-brand-accent">
                            {q.title}
                          </Link>
                        ) : (
                          <p className="text-body-sm font-semibold text-ink-primary">{q.title}</p>
                        )}
                      </div>
                      <span
                        className={`flex-shrink-0 text-caption font-medium px-2.5 py-1 rounded-pill ${
                          q.answered ? 'bg-brand-accent-soft text-brand-accent' : 'bg-[#1E40AF]/10 text-[#1E40AF]'
                        }`}
                      >
                        {q.answered ? 'Answered' : 'In review'}
                      </span>
                    </div>
                  </SectionCard>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div>
            <h2 className="font-serif text-h3 text-ink-primary mb-3">Account</h2>
            <SectionCard>
              <NameForm initialName={data.user.name} email={data.user.email} />
            </SectionCard>
          </div>

          {data.recommended && (
            <div>
              <h2 className="font-serif text-h3 text-ink-primary mb-3">Recommended for you</h2>
              <SectionCard>
                <p className="text-caption text-ink-tertiary mb-1">Based on your quiz</p>
                <Link href={`/services/${data.recommended.slug}`} className="text-body font-semibold text-ink-primary hover:text-brand-accent">
                  {data.recommended.name}
                </Link>
                <p className="text-caption text-ink-tertiary mt-2">
                  Educational only. Not medical advice. Talk to a licensed provider about what is right for you.
                </p>
                <Link href="/quiz" className="inline-block mt-3 text-body-sm text-brand-accent hover:underline">
                  Retake the quiz
                </Link>
              </SectionCard>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
