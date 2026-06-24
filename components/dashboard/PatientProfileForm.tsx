'use client'

import { useState } from 'react'
import { PasswordField } from '@/components/auth/PasswordField'

export function PatientProfileForm({
  userId,
  initialName,
  initialEmail,
}: {
  userId: string
  initialName: string
  initialEmail: string
}) {
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    setError('')
    setBusy(true)

    try {
      const body: Record<string, string> = {}
      if (name !== initialName) body.name = name
      if (email !== initialEmail) body.email = email
      if (newPassword) {
        if (newPassword.length < 8) {
          setError('New password must be at least 8 characters.')
          setBusy(false)
          return
        }
        body.password = newPassword
        body.currentPassword = currentPassword
      }

      if (Object.keys(body).length === 0) {
        setMsg('No changes to save.')
        setBusy(false)
        return
      }

      const res = await fetch('/api/dashboard/patient/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not update profile.')
      } else {
        setMsg('Profile updated.')
        setCurrentPassword('')
        setNewPassword('')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div>
        <label htmlFor="profile-name" className="block text-body-sm font-medium text-ink-primary mb-1.5">
          Full name
        </label>
        <input
          id="profile-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-md border border-border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body-sm"
        />
      </div>

      <div>
        <label htmlFor="profile-email" className="block text-body-sm font-medium text-ink-primary mb-1.5">
          Email address
        </label>
        <input
          id="profile-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-md border border-border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body-sm"
        />
      </div>

      <div className="pt-4 border-t border-border">
        <p className="text-body-sm font-medium text-ink-primary mb-4">Change password (optional)</p>
        <div className="space-y-4">
          <PasswordField
            id="current-password"
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
          />
          <PasswordField
            id="new-password-profile"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            minLength={8}
            placeholder="At least 8 characters"
          />
        </div>
      </div>

      {error && (
        <p className="text-body-sm text-[#B91C1C] bg-[#B91C1C]/5 px-4 py-3 rounded-md border border-[#B91C1C]/20">{error}</p>
      )}
      {msg && (
        <p className="text-body-sm text-brand-accent bg-brand-accent-soft px-4 py-3 rounded-md">{msg}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="bg-brand-primary text-surface-canvas rounded-pill px-6 py-2.5 text-body-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
      >
        {busy ? 'Saving...' : 'Save changes'}
      </button>
    </form>
  )
}
