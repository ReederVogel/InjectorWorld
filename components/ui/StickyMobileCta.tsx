'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export function StickyMobileCta() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY
      const docH = document.documentElement.scrollHeight
      const winH = window.innerHeight
      // Show after passing hero (~720px), hide near footer
      setVisible(y > 720 && y < docH - winH - 520)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      aria-hidden={!visible}
      className={`md:hidden fixed bottom-3 left-3 right-3 z-30 transition-all duration-400 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
      }`}
    >
      <Link
        href="/botox/new-york-ny"
        className="flex items-center justify-between bg-brand-primary text-surface-canvas rounded-pill px-5 py-3.5 shadow-[0_12px_40px_rgba(11,27,52,0.25)] border border-brand-accent/30 backdrop-blur"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex w-6 h-6 rounded-pill bg-brand-accent/20 items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgb(63,166,138)" strokeWidth="2.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </span>
          <span className="text-body-sm font-semibold truncate">Find a verified injector</span>
        </span>
        <span className="inline-flex w-8 h-8 rounded-pill bg-brand-accent items-center justify-center flex-shrink-0 ml-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </Link>
    </div>
  )
}
