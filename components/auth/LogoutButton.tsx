'use client'

import { useState } from 'react'

export function LogoutButton({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleLogout() {
    if (isLoading) return

    setIsLoading(true)
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    }).catch(() => null)

    if (!res?.ok) {
      await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    }

    window.location.assign('/')
  }

  return (
    <button type="button" onClick={handleLogout} disabled={isLoading} className={className}>
      {children ?? 'Sign out'}
    </button>
  )
}
