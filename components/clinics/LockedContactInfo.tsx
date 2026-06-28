'use client'

import { useState, useEffect, useCallback } from 'react'

type ContactData = { phone: string | null; email: string | null }
type Status = 'loading' | 'unlocked' | 'locked'

type Props = {
  clinicId: string
  clinicName: string
  hasPhone: boolean
  hasEmail: boolean
  variant: 'quick' | 'sidebar'
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="inline-block shrink-0">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function AuthModal({ clinicName, onClose }: { clinicName: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-border bg-surface-canvas p-8 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-ink-tertiary transition hover:text-ink-primary"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-accent-soft">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-brand-accent">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h2 className="mb-2 font-serif text-h3 text-ink-primary">Unlock contact details</h2>
        <p className="mb-6 text-body-sm text-ink-secondary">
          Create a free account to view phone numbers, emails, save clinics, and book consultations at {clinicName}.
        </p>

        <div className="space-y-3">
          <a
            href="/create-account"
            className="flex w-full items-center justify-center rounded-pill bg-brand-primary px-6 py-3 text-body-sm font-semibold text-surface-canvas transition hover:opacity-90"
          >
            Create free account
          </a>
          <a
            href="/admin/login"
            className="flex w-full items-center justify-center rounded-pill border border-border px-6 py-3 text-body-sm font-semibold text-ink-primary transition hover:border-brand-accent hover:text-brand-accent"
          >
            Log in
          </a>
        </div>
      </div>
    </div>
  )
}

function QuickItem({
  label,
  status,
  hasData,
  value,
  href,
  onLockedClick,
}: {
  label: string
  status: Status
  hasData: boolean
  value: string | null
  href?: string
  onLockedClick: () => void
}) {
  const labelEl = (
    <span className="block text-caption font-semibold uppercase tracking-[0.08em] text-ink-tertiary">
      {label}
    </span>
  )

  if (status === 'loading') {
    return (
      <div className="rounded-xl border border-border bg-surface-canvas px-4 py-3">
        {labelEl}
        <span className="mt-2 block h-3.5 w-28 animate-pulse rounded bg-border" />
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="rounded-xl border border-border bg-surface-canvas px-4 py-3">
        {labelEl}
        <span className="mt-1 block truncate text-body-sm font-semibold text-ink-tertiary">Not listed</span>
      </div>
    )
  }

  if (status === 'unlocked' && value) {
    return (
      <a
        href={href}
        className="rounded-xl border border-border bg-surface-canvas px-4 py-3 transition hover:border-brand-accent"
      >
        {labelEl}
        <span className="mt-1 block truncate text-body-sm font-semibold text-ink-primary">{value}</span>
      </a>
    )
  }

  return (
    <button
      onClick={onLockedClick}
      className="group w-full rounded-xl border border-border bg-surface-canvas px-4 py-3 text-left transition hover:border-brand-accent"
    >
      {labelEl}
      <span className="mt-1 flex items-center gap-1.5 text-body-sm font-semibold text-ink-tertiary transition group-hover:text-brand-accent">
        <LockIcon />
        Sign in to view
      </span>
    </button>
  )
}

function SidebarItem({
  label,
  status,
  hasData,
  value,
  href,
  onLockedClick,
}: {
  label: string
  status: Status
  hasData: boolean
  value: string | null
  href?: string
  onLockedClick: () => void
}) {
  if (!hasData) return null

  const labelEl = (
    <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-tertiary">{label}</p>
  )

  if (status === 'loading') {
    return (
      <div className="text-body-sm">
        {labelEl}
        <span className="mt-1.5 block h-3.5 w-32 animate-pulse rounded bg-border" />
      </div>
    )
  }

  if (status === 'unlocked' && value) {
    return (
      <div className="text-body-sm">
        {labelEl}
        <p className="mt-1 text-ink-secondary">
          <a href={href} className="text-brand-accent hover:underline">{value}</a>
        </p>
      </div>
    )
  }

  return (
    <div className="text-body-sm">
      {labelEl}
      <button
        onClick={onLockedClick}
        className="mt-1 flex items-center gap-1.5 text-ink-tertiary transition hover:text-brand-accent"
      >
        <LockIcon />
        Sign in to view
      </button>
    </div>
  )
}

export function LockedContactInfo({ clinicId, clinicName, hasPhone, hasEmail, variant }: Props) {
  const [status, setStatus] = useState<Status>('loading')
  const [contact, setContact] = useState<ContactData>({ phone: null, email: null })
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetch(`/api/clinic-contact/${clinicId}`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) { setStatus('locked'); return null }
        return r.json() as Promise<ContactData>
      })
      .then((data) => {
        if (data) {
          setContact(data)
          setStatus('unlocked')
        }
      })
      .catch(() => setStatus('locked'))
  }, [clinicId])

  const openModal = useCallback(() => setShowModal(true), [])
  const closeModal = useCallback(() => setShowModal(false), [])

  if (variant === 'quick') {
    return (
      <>
        <QuickItem
          label="Phone"
          status={status}
          hasData={hasPhone}
          value={contact.phone}
          href={contact.phone ? `tel:${contact.phone}` : undefined}
          onLockedClick={openModal}
        />
        <QuickItem
          label="Email"
          status={status}
          hasData={hasEmail}
          value={contact.email}
          href={contact.email ? `mailto:${contact.email}` : undefined}
          onLockedClick={openModal}
        />
        {showModal && <AuthModal clinicName={clinicName} onClose={closeModal} />}
      </>
    )
  }

  if (!hasPhone && !hasEmail) return null

  return (
    <>
      <SidebarItem
        label="Phone"
        status={status}
        hasData={hasPhone}
        value={contact.phone}
        href={contact.phone ? `tel:${contact.phone}` : undefined}
        onLockedClick={openModal}
      />
      <SidebarItem
        label="Email"
        status={status}
        hasData={hasEmail}
        value={contact.email}
        href={contact.email ? `mailto:${contact.email}` : undefined}
        onLockedClick={openModal}
      />
      {showModal && <AuthModal clinicName={clinicName} onClose={closeModal} />}
    </>
  )
}
