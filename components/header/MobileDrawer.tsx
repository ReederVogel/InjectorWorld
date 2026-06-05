'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Logo } from './Logo'
import { megaMenus, flatNavLinks } from '@/lib/site-nav'
import type { MegaMenu } from '@/lib/site-nav'
import type { SessionUser } from './Header'
import { LogoutButton } from '@/components/auth/LogoutButton'

export function MobileDrawer({
  open,
  onClose,
  user,
}: {
  open: boolean
  onClose: () => void
  user: SessionUser | null
}) {
  const [activeSection, setActiveSection] = useState<MegaMenu['key'] | null>(null)

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const dashboardLink =
    user?.role === 'admin' || user?.role === 'editor' ? '/admin' : '/dashboard'

  return (
    <div className="md:hidden">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close menu"
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-ink-primary/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer */}
      <aside
        aria-hidden={!open}
        className="fixed top-0 right-0 bottom-0 w-[88vw] max-w-[380px] bg-surface-canvas z-[61] shadow-2xl flex flex-col overflow-y-auto transition-transform duration-300 ease-out"
        style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <Logo />
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="w-9 h-9 rounded-pill flex items-center justify-center text-ink-primary hover:bg-surface"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col p-3" aria-label="Mobile">
          {megaMenus.map((menu) => {
            const expanded = activeSection === menu.key
            return (
              <div key={menu.key} className="border-b border-border-subtle">
                <button
                  type="button"
                  className="w-full flex items-center justify-between py-4 px-2 text-left text-body-lg font-medium text-ink-primary"
                  aria-expanded={expanded}
                  onClick={() => setActiveSection(expanded ? null : menu.key)}
                >
                  {menu.trigger}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <div
                  className="grid transition-all duration-300 ease-out"
                  style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <div className="pb-4 pl-2 pr-2 space-y-4">
                      {menu.sections.map((section) => (
                        <div key={section.heading}>
                          <div className="overline text-brand-accent mb-2">{section.heading}</div>
                          <ul className="space-y-2 text-body-sm">
                            {section.links.map((l) => (
                              <li key={l.href}>
                                <Link
                                  href={l.href}
                                  onClick={onClose}
                                  className="text-ink-secondary block py-1.5 hover:text-brand-accent"
                                >
                                  {l.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {flatNavLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={onClose}
              className="block py-4 px-2 text-body-lg font-medium text-ink-primary border-b border-border-subtle"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto p-5 border-t border-border-subtle space-y-3">
          <Link
            href="/list-your-practice"
            onClick={onClose}
            className="block text-center bg-brand-primary text-surface-canvas rounded-pill py-3 text-body-sm font-medium"
          >
            List your practice
          </Link>

          {user ? (
            <div className="space-y-2">
              <Link
                href={dashboardLink}
                onClick={onClose}
                className="block text-center border border-border rounded-pill py-3 text-body-sm font-medium text-ink-primary"
              >
                {user.role === 'admin' || user.role === 'editor' ? 'Admin panel' : 'Dashboard'}
              </Link>
              <LogoutButton className="block w-full text-center border border-border-subtle rounded-pill py-3 text-body-sm font-medium text-ink-secondary">
                Sign out
              </LogoutButton>
            </div>
          ) : (
            <Link
              href="/login"
              onClick={onClose}
              className="block text-center border border-border rounded-pill py-3 text-body-sm font-medium text-ink-primary"
            >
              Sign in
            </Link>
          )}
        </div>
      </aside>
    </div>
  )
}
