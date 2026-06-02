'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { StateRow } from '@/lib/home-queries'

export function BrowseStateClient({ states }: { states: StateRow[] }) {
  const [expanded, setExpanded] = useState(false)
  const [visibleSet, setVisibleSet] = useState(new Set<string>())
  const ref = useRef<HTMLDivElement>(null)

  const featured = states.filter((s) => s.featured).slice(0, 12)
  const rest = states.filter((s) => !s.featured)
  const shown = expanded ? [...featured, ...rest] : featured

  useEffect(() => {
    if (!ref.current) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const id = (e.target as HTMLElement).dataset.id
          if (id) setVisibleSet((prev) => new Set(prev).add(id))
        }
      })
    }, { threshold: 0.2, rootMargin: '40px 0px' })
    ref.current.querySelectorAll('[data-id]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [expanded])

  return (
    <div ref={ref}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 md:gap-3">
        {shown.map((s, i) => (
          <Link
            key={s.id}
            href={`/botox/${s.slug.replace(/^state-/, '')}`}
            data-id={s.id}
            style={{ transitionDelay: visibleSet.has(s.id) ? `${(i % 12) * 30}ms` : '0ms' }}
            className={`group flex items-center justify-between px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#3FA68A] transition-all duration-300 ${
              visibleSet.has(s.id) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
          >
            <span className="text-body-sm font-medium text-white truncate">{s.name}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-white/50 group-hover:text-[#3FA68A] group-hover:translate-x-0.5 transition flex-shrink-0 ml-2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        ))}
      </div>

      {!expanded && rest.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-pill bg-white/8 border border-white/15 text-body-sm text-white hover:bg-white/12 hover:border-[#3FA68A] transition"
          >
            <span>+ {rest.length} more states</span>
          </button>
        </div>
      )}
    </div>
  )
}
