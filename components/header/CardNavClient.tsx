'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Logo } from './Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { fetchSuggest, searchHref, type Suggestion } from '@/lib/search-client'
import { useSession } from '@/components/account/SessionContext'
import { navCards, navLeadFallback, type NavCard as NavCardType, type NavLead } from '@/lib/site-nav'
import type { SessionUser } from './Header'

const NAV_CLOSED = 64

const POPULAR_SEARCHES = ['Botox', 'Lip Filler', 'Masseter Botox', 'Tear trough', 'Sculptra', 'New York', 'Los Angeles', 'Houston']
const TYPE_LABEL: Record<string, string> = { treatment: 'Treatment', location: 'Location', zip: 'ZIP', provider: 'Injector', clinic: 'Clinic' }

const LinkArrow = () => (
  <svg aria-hidden width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
  </svg>
)
const RightArrow = () => (
  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
)

/** One colored card with internal sub-tabs. Tab state is local so switching a
 *  tab re-renders only this card, never the parent <nav> (keeps GSAP height). */
function NavCard({
  card,
  registerRef,
  onNavigate,
}: {
  card: NavCardType
  registerRef: (el: HTMLDivElement | null) => void
  onNavigate: () => void
}) {
  const [active, setActive] = useState(card.tabs[0]?.key)
  const lightText = card.fg === '#ffffff'
  const tabBorder = lightText ? 'rgba(255,255,255,0.18)' : '#EFE9DF'
  const activeTab = card.tabs.find((t) => t.key === active) ?? card.tabs[0]

  return (
    <div ref={registerRef} className="flex-1 min-w-0 rounded-xl p-4 md:p-5" style={{ backgroundColor: card.bg }}>
      <div className="text-[17px] md:text-[19px] font-semibold mb-3 leading-tight" style={{ color: card.fg, opacity: 0.85 }}>
        {card.label}
      </div>

      <div
        className="flex gap-4 mb-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b"
        style={{ borderColor: tabBorder }}
        role="tablist"
        aria-label={`${card.label} categories`}
      >
        {card.tabs.map((t) => {
          const on = t.key === active
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.key)}
              className="text-[12px] whitespace-nowrap pb-2 -mb-px transition-opacity"
              style={{ color: card.fg, opacity: on ? 1 : 0.6, fontWeight: on ? 600 : 400, borderBottom: `2px solid ${on ? card.accent : 'transparent'}` }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-2">
        {activeTab?.links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            className="inline-flex items-center gap-2 text-[13px] leading-snug transition-opacity hover:opacity-70"
            style={{ color: card.fg }}
          >
            <LinkArrow />
            {l.label}
          </Link>
        ))}
      </div>

      <Link
        href={card.viewAll.href}
        onClick={onNavigate}
        className="flex items-center gap-1.5 text-[12px] font-semibold mt-3 pt-3 transition-opacity hover:opacity-70"
        style={{ color: card.accent, borderTop: `1px solid ${tabBorder}` }}
      >
        {card.viewAll.label}
        <RightArrow />
      </Link>
    </div>
  )
}

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

export function CardNavClient({ user: initialUser, lead }: { user: SessionUser | null; lead?: NavLead | null }) {
  const { user: sessionUser } = useSession()
  const user = initialUser ?? sessionUser
  const leadData = lead ?? navLeadFallback
  const [open, setOpen] = useState(false)
  const [navHeight, setNavHeight] = useState(NAV_CLOSED)
  const [searchOpen, setSearchOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Close on route change
  useEffect(() => { setOpen(false) }, [pathname])

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

  // Sync nav height when open state or content changes
  useLayoutEffect(() => {
    if (open) {
      const panel = panelRef.current
      const natural = NAV_CLOSED + (panel ? panel.scrollHeight + 4 : 320)
      setNavHeight(Math.min(natural, window.innerHeight))
    } else {
      setNavHeight(NAV_CLOSED)
    }
  }, [open])

  // Re-measure on resize while open
  useLayoutEffect(() => {
    function onResize() {
      if (!open) return
      const panel = panelRef.current
      const natural = NAV_CLOSED + (panel ? panel.scrollHeight + 4 : 320)
      setNavHeight(Math.min(natural, window.innerHeight))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open])

  function toggle() {
    setOpen((v) => !v)
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
            className="max-w-5xl mx-auto rounded-2xl bg-surface-canvas/95 backdrop-blur-md border border-border shadow-hover transition-[height] duration-[420ms] ease-out"
            style={{ height: navHeight, overflow: (avatarOpen && !open) ? 'visible' : 'hidden' }}
          >
            {/* ── Top bar ─────────────────────────────────────────────── */}
            <div className="relative flex items-center justify-between h-[64px] px-4 md:px-5">

              {/* Hamburger */}
              <button
                type="button"
                onClick={toggle}
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
                className="flex flex-col gap-[6px] w-11 h-11 items-center justify-center rounded-lg hover:bg-surface transition"
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
                  className="w-9 h-9 min-[380px]:w-11 min-[380px]:h-11 flex items-center justify-center text-ink-secondary hover:text-ink-primary rounded-lg hover:bg-surface transition"
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
                  <Link href="/login" className="flex items-center gap-1.5 w-11 h-11 justify-center sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 text-[13px] font-medium text-ink-secondary hover:text-ink-primary rounded-lg hover:bg-surface transition" aria-label="Sign in">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></svg>
                    <span className="hidden sm:inline">Sign in</span>
                  </Link>
                )}

                <Link
                  href="/list-your-practice"
                  className="hidden md:inline-flex items-center bg-brand-primary text-surface-canvas rounded-pill px-4 py-2 text-[13px] font-medium hover:opacity-90 transition"
                >
                  List your practice
                </Link>

                <span className="hidden md:flex"><ThemeToggle /></span>
              </div>
            </div>

            {/* ── Drawer panel ────────────────────────────────────────── */}
            <div ref={panelRef} className="px-2.5 pb-2.5 overflow-y-auto overscroll-contain" style={{ maxHeight: `calc(100dvh - ${NAV_CLOSED}px)` }}>

              {/* Editorial lead strip (latest news, dynamic) */}
              <div className={`pb-2 transition-[opacity,transform] duration-[380ms] ease-out ${open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-warm p-2.5">
                  <Link href={leadData.href} onClick={() => setOpen(false)} className="flex items-center gap-3 min-w-0 flex-1 group">
                    <span className="w-[60px] h-[46px] md:w-[64px] rounded-lg bg-[#0B1B34] flex items-center justify-center text-brand-accent flex-shrink-0" aria-hidden>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 5a1 1 0 0 0-1 1v12a2 2 0 0 0 2 2h13" /><path d="M5 5h11a2 2 0 0 1 2 2v11a1 1 0 0 0 2 0V9" />
                        <line x1="7" y1="9" x2="13" y2="9" /><line x1="7" y1="13" x2="11" y2="13" />
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-[0.07em] font-semibold text-brand-accent">{leadData.overline}</span>
                      <span
                        className="block font-serif text-[15px] md:text-[16px] text-ink-primary leading-snug mt-0.5 group-hover:opacity-70 transition-opacity"
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                      >
                        {leadData.title}
                      </span>
                    </span>
                  </Link>
                  <Link
                    href={leadData.allHref}
                    onClick={() => setOpen(false)}
                    className="ml-auto flex items-center gap-1 text-[12px] font-semibold text-brand-accent whitespace-nowrap hover:opacity-70 transition-opacity"
                  >
                    {leadData.allLabel}
                    <RightArrow />
                  </Link>
                </div>
              </div>

              {/* Sub-tab cards */}
              <div className="flex flex-col md:flex-row gap-2">
                {navCards.map((card, idx) => (
                  <div
                    key={card.label}
                    className="flex-1 min-w-0 transition-[opacity,transform] ease-out"
                    style={{
                      transitionDuration: `${380 + idx * 70}ms`,
                      transitionDelay: open ? `${idx * 40}ms` : '0ms',
                      opacity: open ? 1 : 0,
                      transform: open ? 'translateY(0)' : 'translateY(16px)',
                    }}
                  >
                    <NavCard
                      card={card}
                      registerRef={() => {}}
                      onNavigate={() => setOpen(false)}
                    />
                  </div>
                ))}
              </div>

              <div className="md:hidden flex items-center justify-end px-1 pt-2">
                <ThemeToggle />
              </div>
            </div>
          </nav>
        </div>
      </header>
    </>
  )
}
