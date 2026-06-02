'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { BodyArea } from '@/lib/body-areas-data'
import { CarouselDots } from '@/components/ui/CarouselDots'

export function BodyAreasCarousel({ areas }: { areas: BodyArea[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)
  const [paused, setPaused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const totalCount = areas.length + 1

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function updateState() {
    const el = scrollRef.current
    if (!el) return
    setCanPrev(el.scrollLeft > 8)
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
    const cardW = el.scrollWidth / Math.max(1, totalCount)
    setActiveIndex(Math.min(totalCount - 1, Math.max(0, Math.round(el.scrollLeft / cardW))))
  }

  function scrollByCard(dir: 'prev' | 'next') {
    const el = scrollRef.current
    if (!el) return
    const delta = Math.min(el.clientWidth * 0.7, 600) * (dir === 'next' ? 1 : -1)
    el.scrollBy({ left: delta, behavior: 'smooth' })
  }

  useEffect(() => {
    if (paused || reducedMotion) return
    const id = setInterval(() => {
      const el = scrollRef.current
      if (!el) return
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + Math.min(el.clientWidth * 0.7, 600), behavior: 'smooth' })
    }, 5000)
    return () => clearInterval(id)
  }, [paused, reducedMotion])

  useEffect(() => {
    updateState()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateState, { passive: true })
    window.addEventListener('resize', updateState)
    return () => {
      el.removeEventListener('scroll', updateState)
      window.removeEventListener('resize', updateState)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); scrollByCard('prev') }
        if (e.key === 'ArrowRight') { e.preventDefault(); scrollByCard('next') }
      }}
    >
      <div
        ref={scrollRef}
        className="flex items-start gap-3 md:gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory hide-scrollbar -mx-5 md:-mx-10 px-5 md:px-10 py-1"
      >
        {areas.map((area, i) => (
          <Link
            key={area.slug}
            href={`/treatments/${area.slug}`}
            className={`relative block flex-shrink-0 w-[72vw] h-[96vw] md:w-[300px] md:h-auto md:aspect-[3/4] rounded-2xl overflow-hidden snap-start group bg-surface transition-shadow duration-300 ${
              activeIndex === i ? 'ring-2 ring-brand-accent md:ring-0' : ''
            }`}
          >
            {/* Light image — hidden in dark mode */}
            <Image
              src={area.imageUrlLight}
              alt={`${area.name} treatments`}
              fill
              sizes="(min-width: 768px) 300px, 72vw"
              className="object-cover transition-[opacity,transform] duration-700 ease-out group-hover:scale-105 dark:opacity-0"
            />
            {/* Dark image — shown in dark mode */}
            <Image
              src={area.imageUrlDark}
              alt=""
              aria-hidden
              fill
              sizes="(min-width: 768px) 300px, 72vw"
              className="object-cover transition-[opacity,transform] duration-700 ease-out group-hover:scale-105 opacity-0 dark:opacity-100"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/80" />

            {/* Center name — shifts up on hover to reveal bottom content */}
            <div className="absolute inset-0 flex items-center justify-center p-5 text-center pointer-events-none">
              <span className="text-white font-bold uppercase tracking-tight leading-[0.95] text-[26px] md:text-[34px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-transform duration-500 ease-out group-hover:-translate-y-4">
                {area.name}
              </span>
            </div>

            {/* Bottom strip */}
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {area.treatments.split(' · ').map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-2 py-0.5 rounded-pill bg-white/15 backdrop-blur-sm text-white font-medium transition-colors duration-300 group-hover:bg-white/28"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="text-white/70 text-[11px] leading-snug line-clamp-2 transition-colors duration-300 group-hover:text-white/95">
                    {area.tagline}
                  </div>
                </div>
                <div className="flex-shrink-0 w-9 h-9 rounded-pill bg-white/15 backdrop-blur-sm flex items-center justify-center text-white transition-all duration-300 group-hover:bg-brand-accent group-hover:translate-x-0.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        ))}

        {/* See all tile */}
        <Link
          href="/treatments"
          className="relative block flex-shrink-0 w-[72vw] h-[96vw] md:w-[300px] md:h-auto md:aspect-[3/4] rounded-2xl overflow-hidden snap-start group bg-brand-primary text-surface-canvas"
        >
          <Image
            src="/images/body-areas/seeall_light.png"
            alt="See all treatments"
            fill
            sizes="(min-width: 768px) 240px, 200px"
            className="object-cover transition-[opacity,transform] duration-700 ease-out group-hover:scale-105 dark:opacity-0"
          />
          <Image
            src="/images/body-areas/seeall_dark.png"
            alt=""
            aria-hidden
            fill
            sizes="(min-width: 768px) 240px, 200px"
            className="object-cover transition-[opacity,transform] duration-700 ease-out group-hover:scale-105 opacity-0 dark:opacity-100"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center px-6">
              <span className="block font-bold uppercase tracking-tight leading-none text-[26px] md:text-[32px] text-white">See all</span>
              <span className="block mt-2 text-body-sm text-white/80">30+ treatments</span>
              <div className="mx-auto mt-6 w-10 h-10 rounded-pill bg-white/15 backdrop-blur-sm flex items-center justify-center transition group-hover:bg-brand-accent">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </div>
          </div>
        </Link>
      </div>

      <CarouselDots scrollRef={scrollRef} count={totalCount} activeIndex={activeIndex} />

      <button
        type="button"
        aria-label="Previous"
        onClick={() => scrollByCard('prev')}
        disabled={!canPrev}
        className={`hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-pill bg-surface-canvas border border-border shadow-md items-center justify-center text-ink-primary transition hover:bg-brand-primary hover:text-surface-canvas hover:border-brand-primary z-10 ${
          canPrev ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={() => scrollByCard('next')}
        disabled={!canNext}
        className={`hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-pill bg-surface-canvas border border-border shadow-md items-center justify-center text-ink-primary transition hover:bg-brand-primary hover:text-surface-canvas hover:border-brand-primary z-10 ${
          canNext ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  )
}
