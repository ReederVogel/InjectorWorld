'use client'

import { useState } from 'react'

export function LogoutButton({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleLogout() {
    if (isLoading) return

    setIsLoading(true)
    // Payload's logout ends the session in the database. Our route only clears the
    // cookie, so on its own a copied cookie stayed valid for 7 days after sign out.
    // It still runs second: it clears the cookie even when there was no session to end.
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(() => null)
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include', cache: 'no-store' }).catch(() => null)

    window.location.assign('/')
  }

  return (
    <button type="button" onClick={handleLogout} disabled={isLoading} className={className}>
      {children ?? 'Sign out'}
    </button>
  )
}
