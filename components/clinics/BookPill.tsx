'use client'

import { useEffect, useState } from 'react'

/**
 * Small "Book" pill pinned to the bottom-right on the clinic profile, mobile
 * and tablet only. Added 2026-08-06 (client request) in place of the sitewide
 * StickyMobileCta, which was removed.
 *
 * The hero's own Book button scrolls out of view almost immediately, so this
 * takes over. Revised 2026-08-06: it hides only while the booking form is
 * actually on screen (the shortcut would point at something the visitor is
 * already looking at) and comes straight back once the form scrolls past. It is
 * never retired permanently.
 *
 * The observer drives visibility continuously rather than latching once, so a
 * restored scroll position on a client-side navigation cannot strand it in the
 * wrong state.
 *
 * Hidden from lg up: the desktop layout keeps the whole form sticky in the
 * sidebar, so a shortcut to it would point at something already on screen.
 */
export function BookPill({ targetId = 'book' }: { targetId?: string }) {
  const [formOnScreen, setFormOnScreen] = useState(false)

  useEffect(() => {
    const target = document.getElementById(targetId)
    if (!target) return

    // threshold 0: any sliver of the form counts as "the visitor is there".
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setFormOnScreen(entry.isIntersecting)
      },
      { threshold: 0 },
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [targetId])

  function scrollToForm() {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <button
      type="button"
      onClick={scrollToForm}
      aria-label="Book a consultation"
      aria-hidden={formOnScreen}
      tabIndex={formOnScreen ? -1 : 0}
      className={`fixed bottom-5 right-4 z-40 flex min-h-11 items-center gap-2 rounded-full bg-brand-primary px-5 py-3 text-body-sm font-semibold text-surface-canvas shadow-[0_12px_40px_rgba(11,27,52,0.28)] transition-all duration-300 ease-out motion-reduce:transition-none lg:hidden ${
        formOnScreen
          ? 'pointer-events-none translate-y-6 scale-75 opacity-0'
          : 'translate-y-0 scale-100 opacity-100'
      }`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
      Book
    </button>
  )
}
