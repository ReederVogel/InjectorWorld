'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Logo } from './Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { fetchSuggest, searchHref, type Suggestion } from '@/lib/search-client'
import type { SessionUser } from './Header'

const NAV_CLOSED = 64
const EASE = 'power3.out'

const POPULAR_SEARCHES = ['Botox', 'Lip Filler', 'Masseter Botox', 'Tear trough', 'Sculptra', 'New York', 'Los Angeles', 'Houston']
const TYPE_LABEL: Record<string, string> = { treatment: 'Treatment', location: 'Location', zip: 'ZIP', provider: 'Injector', clinic: 'Clinic' }

const CARDS = [
  {
    label: 'Treatments',
    bg: '#0B1B34',
    fg: '#ffffff',
    links: [
      { label: 'Botox', href: '/botox' },
      { label: 'Lip Filler', href: '/lip-filler' },
      { label: 'Cheek Filler', href: '/cheek-filler' },
      { label: 'Dysport', href: '/dysport' },
      { label: 'Masseter Botox', href: '/masseter-botox' },
      { label: 'All treatments', href: '/guides' },
    ],
  },
  {
    label: 'Find',
    bg: '#3FA68A',
    fg: '#ffffff',
    links: [
      { label: 'All Injectors', href: '/injectors' },
      { label: 'All Clinics', href: '/clinics' },
      { label: 'New York City', href: '/botox/new-york-ny' },
      { label: 'Los Angeles', href: '/botox/los-angeles-ca' },
      { label: 'Houston', href: '/botox/houston-tx' },
    ],
  },
  {
    label: 'Learn',
    bg: '#FAF7F2',
    fg: '#0B1B34',
    links: [
      { label: 'Guides', href: '/guides' },
      { label: 'How we verify', href: '/how-we-verify' },
      { label: 'About', href: '/about' },
      { label: 'List your practice', href: '/list-your-practice' },
    ],
  },
]

function MobileSearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => inputRef.current?.focus(), 80)
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; clearTimeout(t); document.removeEventListener('keydown', onKey) }
  }, [onClose])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) { setSuggestions([]); return }
    const ctrl = new AbortController()
    const id = setTimeout(async () => setSuggestions(await fetchSuggest(term, ctrl.signal)), 180)
    return () => { clearTimeout(id); ctrl.abort() }
  }, [query])

  function handleSubmit(e: React.FormEvent) { e.preventDefault(); onClose(); router.push(searchHref(query)) }
  function go(href: string) { onClose(); router.push(href) }

  return (
    <div className="fixed inset-0 z-50 bg-surface-canvas flex flex-col" role="dialog" aria-modal aria-label="Search">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button type="button" onClick={onClose} aria-label="Close search" className="w-9 h-9 flex items-center justify-center rounded-full text-ink-secondary hover:text-ink-primary hover:bg-surface transition">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
        <span className="font-serif text-body font-medium text-ink-primary">Find a provider</span>
      </div>
      <form onSubmit={handleSubmit} className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface focus-within:border-brand-accent transition">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-tertiary flex-shrink-0"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Treatment, city, ZIP, injector, or clinic" className="flex-1 outline-none text-body bg-transparent text-ink-primary placeholder:text-ink-tertiary" aria-label="Search" />
          {query && <button type="button" onClick={() => setQuery('')} className="text-ink-tertiary hover:text-ink-primary transition" aria-label="Clear"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>}
        </div>
        <button type="submit" className="w-full mt-3 bg-brand-primary text-surface-canvas rounded-pill py-3.5 text-body font-semibold hover:opacity-90 active:scale-[0.99] transition">Search</button>
      </form>
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {suggestions.length > 0 ? (
          <ul role="listbox" aria-label="Suggestions" className="divide-y divide-border-subtle">
            {suggestions.map((s, i) => (
              <li key={`${s.type}-${s.href}-${i}`} role="option" aria-selected={false}>
                <button type="button" onClick={() => go(s.href)} className="w-full text-left py-3 flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-body text-ink-primary truncate">{s.label}</span>
                    {s.sublabel && <span className="block text-caption text-ink-tertiary truncate">{s.sublabel}</span>}
                  </span>
                  <span className="text-caption text-ink-tertiary flex-shrink-0">{TYPE_LABEL[s.type]}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div>
            <p className="text-overline uppercase tracking-widest font-semibold text-ink-tertiary mb-3">Popular searches</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_SEARCHES.map(t => (
                <button key={t} type="button" onClick={() => go(searchHref(t))} className="px-3 py-1.5 rounded-pill text-body-sm border border-border text-ink-secondary hover:border-brand-accent hover:text-ink-primary bg-surface-canvas transition">{t}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function CardNavClient({ user: initialUser }: { user: SessionUser | null }) {
  const [user, setUser] = useState<SessionUser | null>(initialUser)
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const cardsRef = useRef<HTMLDivElement[]>([])
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const avatarRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Close on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Auth hydration
  useEffect(() => {
    if (initialUser) { setUser(initialUser); return }
    let active = true
    fetch('/api/account/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (active && data?.user) setUser({ id: data.user.id, name: data.user.name ?? null, email: data.user.email, role: data.user.role ?? null }) })
      .catch(() => {})
    return () => { active = false }
  }, [initialUser])

  // Avatar outside click
  useEffect(() => {
    if (!avatarOpen) return
    function onOutside(e: MouseEvent) { if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false) }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [avatarOpen])

  // ESC to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { setOpen(false); setAvatarOpen(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function getOpenHeight() {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    return isMobile ? NAV_CLOSED + CARDS.length * 96 + 28 : NAV_CLOSED + 244
  }

  function buildTl() {
    const navEl = navRef.current
    if (!navEl) return null
    gsap.set(navEl, { height: NAV_CLOSED })
    gsap.set(cardsRef.current.filter(Boolean), { y: 40, opacity: 0 })
    const tl = gsap.timeline({ paused: true })
    tl.to(navEl, { height: getOpenHeight, duration: 0.42, ease: EASE })
    tl.to(cardsRef.current.filter(Boolean), { y: 0, opacity: 1, duration: 0.38, ease: EASE, stagger: 0.07 }, '-=0.15')
    return tl
  }

  useLayoutEffect(() => {
    tlRef.current = buildTl()
    return () => { tlRef.current?.kill() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    function onResize() {
      if (!tlRef.current) return
      const progress = open ? 1 : 0
      tlRef.current.kill()
      tlRef.current = buildTl()
      if (progress === 1) tlRef.current?.progress(1)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function toggle() {
    const tl = tlRef.current
    if (!tl) return
    if (!open) { setOpen(true); tl.play(0) }
    else { tl.eventCallback('onReverseComplete', () => setOpen(false)); tl.reverse() }
  }

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?'
  const dashboardLink = user?.role === 'admin' || user?.role === 'editor' ? '/admin' : '/dashboard'

  return (
    <>
      {searchOpen && <MobileSearchOverlay onClose={() => setSearchOpen(false)} />}

      <header className="sticky top-0 z-40">
        <div className="px-3 md:px-6 pt-2.5">
          <nav
            ref={navRef as React.RefObject<HTMLElement>}
            className="max-w-5xl mx-auto rounded-2xl bg-surface-canvas/95 backdrop-blur-md border border-border shadow-hover"
            style={{ height: NAV_CLOSED, overflow: 'hidden' }}
          >
            {/* ── Top bar ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between h-[64px] px-4 md:px-5">

              {/* Hamburger */}
              <button
                type="button"
                onClick={toggle}
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
                className="flex flex-col gap-[6px] w-9 h-9 items-center justify-center rounded-lg hover:bg-surface transition"
              >
                <span className={`block h-[2px] bg-ink-primary rounded-full transition-all duration-300 origin-center ${open ? 'w-5 translate-y-[8px] rotate-45' : 'w-6'}`} />
                <span className={`block h-[2px] bg-ink-primary rounded-full transition-all duration-300 ${open ? 'opacity-0 w-5' : 'w-6'}`} />
                <span className={`block h-[2px] bg-ink-primary rounded-full transition-all duration-300 origin-center ${open ? 'w-5 -translate-y-[8px] -rotate-45' : 'w-6'}`} />
              </button>

              {/* Logo — absolutely centered */}
              <div className="absolute left-1/2 -translate-x-1/2">
                <Logo />
              </div>

              {/* Right actions */}
              <div className="flex items-center gap-1.5 md:gap-2">
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search"
                  className="p-2 text-ink-secondary hover:text-ink-primary rounded-lg hover:bg-surface transition"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>

                {user ? (
                  <div ref={avatarRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setAvatarOpen(v => !v)}
                      aria-expanded={avatarOpen}
                      aria-label="Account menu"
                      className="w-8 h-8 rounded-full bg-brand-primary text-surface-canvas flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                    >
                      {initials}
                    </button>
                    {avatarOpen && (
                      <div className="absolute right-0 top-full mt-2 w-44 bg-surface-canvas rounded-xl border border-border shadow-lg py-1 z-50">
                        <Link href={dashboardLink} onClick={() => setAvatarOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-body-sm text-ink-primary hover:bg-surface transition">
                          {user.role === 'admin' || user.role === 'editor' ? 'Admin panel' : 'Dashboard'}
                        </Link>
                        <div className="border-t border-border-subtle my-1" />
                        <LogoutButton className="w-full flex items-center gap-2.5 px-4 py-2.5 text-body-sm text-ink-secondary hover:text-ink-primary hover:bg-surface transition text-left">
                          Sign out
                        </LogoutButton>
                      </div>
                    )}
                  </div>
                ) : (
                  <Link href="/login" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-ink-secondary hover:text-ink-primary rounded-lg hover:bg-surface transition" aria-label="Sign in">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></svg>
                    Sign in
                  </Link>
                )}

                <Link
                  href="/list-your-practice"
                  className="hidden md:inline-flex items-center bg-brand-primary text-surface-canvas rounded-pill px-4 py-2 text-[13px] font-medium hover:opacity-90 transition"
                >
                  List your practice
                </Link>

                <ThemeToggle />
              </div>
            </div>

            {/* ── Card panels ─────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row gap-2 px-2.5 pb-2.5">
              {CARDS.map((card, idx) => (
                <div
                  key={card.label}
                  ref={el => { if (el) cardsRef.current[idx] = el }}
                  className="flex-1 rounded-xl p-4 md:p-5"
                  style={{ backgroundColor: card.bg }}
                >
                  <div
                    className="text-[17px] md:text-[19px] font-semibold mb-3 leading-tight"
                    style={{ color: card.fg, opacity: 0.8 }}
                  >
                    {card.label}
                  </div>
                  <div className="flex flex-col gap-2">
                    {card.links.map(l => (
                      <Link
                        key={l.href}
                        href={l.href}
                        onClick={() => setOpen(false)}
                        className="inline-flex items-center gap-2 text-[13px] leading-snug transition-opacity hover:opacity-70"
                        style={{ color: card.fg }}
                      >
                        <svg aria-hidden width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
                        </svg>
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </nav>
        </div>
      </header>
    </>
  )
}
