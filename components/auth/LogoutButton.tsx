'use client'

import { useRouter } from 'next/navigation'

export function LogoutButton({ className, children }: { className?: string; children?: React.ReactNode }) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    router.refresh()
    router.push('/')
  }

  return (
    <button type="button" onClick={handleLogout} className={className}>
      {children ?? 'Sign out'}
    </button>
  )
}
