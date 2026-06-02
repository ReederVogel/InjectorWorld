'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Logo } from './Logo'
import { MegaPanel } from './MegaPanel'
import { MobileDrawer } from './MobileDrawer'
import { ThemeToggle } from '@/components/ThemeToggle'
import { megaMenus, flatNavLinks } from '@/lib/site-nav'
import type { MegaMenu } from '@/lib/site-nav'

export function HeaderClient() {
  const [openKey, setOpenKey] = useState<MegaMenu['key'] | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenKey(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleEnter(key: MegaMenu['key']) {
    if (closeTimeout.current) clearTimeout(closeTimeout.current)
    setOpenKey(key)
  }
  function handleLeave() {
    if (closeTimeout.current) clearTimeout(closeTimeout.current)
    closeTimeout.current = setTimeout(() => setOpenKey(null), 120)
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-surface-canvas/85 backdrop-blur-md border-b border-border-subtle">
        <div className="max-canvas h-16 md:h-[72px] flex items-center justify-between gap-4">
          {/* LEFT: hamburger (mobile) + logo (desktop) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              className="md:hidden -ml-2 p-2 text-ink-primary rounded-md hover:bg-surface active:bg-surface/80 transition"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
            <Logo className="hidden md:flex" />
          </div>

          {/* CENTER on mobile: logo. Desktop: mega nav */}
          <div className="md:hidden">
            <Logo />
          </div>

          <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
            {megaMenus.map((menu) => (
              <div
                key={menu.key}
                className="relative"
                onMouseEnter={() => handleEnter(menu.key)}
                onMouseLeave={handleLeave}
              >
                <button
                  type="button"
                  className="flex items-center gap-1 px-4 py-2 text-body-sm font-medium text-ink-primary hover:text-brand-accent transition"
                  aria-expanded={openKey === menu.key}
                  aria-haspopup="true"
                  onClick={() => setOpenKey(openKey === menu.key ? null : menu.key)}
                >
                  {menu.trigger}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            ))}
            {flatNavLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="px-4 py-2 text-body-sm font-medium text-ink-primary hover:text-brand-accent transition"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* RIGHT */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <Link
              href="/sign-in"
              className="hidden md:flex items-center gap-2 group"
              aria-label="Sign in"
            >
              <span className="w-9 h-9 rounded-pill bg-surface border border-border flex items-center justify-center group-hover:bg-brand-accent-soft group-hover:border-brand-accent transition">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-secondary group-hover:text-ink-primary">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21a8 8 0 0116 0" />
                </svg>
              </span>
              <span className="hidden lg:inline text-[13px] font-medium text-ink-secondary group-hover:text-ink-primary">Sign in</span>
            </Link>
            <Link
              href="/list-your-practice"
              className="hidden md:inline-flex items-center bg-brand-primary text-surface-canvas rounded-pill px-4 py-2 text-body-sm font-medium hover:opacity-90 transition"
            >
              List your practice
            </Link>
            <ThemeToggle />
          </div>
        </div>

        {/* Desktop mega panels */}
        {megaMenus.map((menu) => (
          <div
            key={menu.key}
            onMouseEnter={() => handleEnter(menu.key)}
            onMouseLeave={handleLeave}
            className={`absolute left-0 right-0 top-full bg-surface-canvas border-t border-border-subtle border-b border-border shadow-lg transition-all duration-200 hidden md:block ${
              openKey === menu.key
                ? 'opacity-100 visible translate-y-0'
                : 'opacity-0 invisible -translate-y-2 pointer-events-none'
            }`}
            aria-hidden={openKey !== menu.key}
          >
            <MegaPanel menu={menu} />
          </div>
        ))}
      </header>

      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  )
}
