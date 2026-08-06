'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Small "Book" pill pinned to the bottom-right on the clinic profile, mobile
 * and tablet only. Added 2026-08-06 (client request) in place of the sitewide
 * StickyMobileCta, which was removed.
 *
 * The hero's own Book button scrolls out of view almost immediately, so this
 * takes over: it stays pinned until the booking form itself reaches the
 * viewport, then merges into it and is gone for good. Coming back after the
 * visitor has already seen the form would just be nagging, hence the one-way
 * `retired` ref.
 *
 * Hidden from lg up: the desktop layout keeps the whole form sticky in the
 * sidebar, so a shortcut to it would point at something already on screen.
 */
export function BookPill({ targetId = 'book' }: { targetId?: string }) {
  const [phase, setPhase] = useState<'visible' | 'merging' | 'gone'>('visible')
  const retired = useRef(false)

  useEffect(() => {
    const target = document.getElementById(targetId)
    if (!target) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || retired.current) continue
          retired.current = true
          observer.disconnect()
          if (reduceMotion) {
            setPhase('gone')
            return
          }
          setPhase('merging')
          window.setTimeout(() => setPhase('gone'), 320)
        }
      },
      // A sliver of the form is enough: the pill should be out of the way
      // before the visitor starts filling anything in.
      { threshold: 0.12 },
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [targetId])

  if (phase === 'gone') return null

  function scrollToForm() {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <button
      type="button"
      onClick={scrollToForm}
      aria-label="Book a consultation"
      className={`fixed bottom-5 right-4 z-40 flex min-h-11 items-center gap-2 rounded-full bg-brand-primary px-5 py-3 text-body-sm font-semibold text-surface-canvas shadow-[0_12px_40px_rgba(11,27,52,0.28)] transition-all duration-300 ease-out lg:hidden ${
        phase === 'merging' ? 'translate-y-6 scale-75 opacity-0' : 'translate-y-0 scale-100 opacity-100'
      }`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
      Book
    </button>
  )
}
