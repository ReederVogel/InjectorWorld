'use client'

export function LogoutButton({ className, children }: { className?: string; children?: React.ReactNode }) {
  async function handleLogout() {
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    window.location.href = '/'
  }

  return (
    <button type="button" onClick={handleLogout} className={className}>
      {children ?? 'Sign out'}
    </button>
  )
}
