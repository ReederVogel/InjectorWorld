'use client'

import { RefObject, useEffect, useState } from 'react'

export function CarouselDots({
  scrollRef,
  count,
  activeIndex: activeIndexProp,
  className = '',
}: {
  scrollRef: RefObject<HTMLDivElement | null>
  count: number
  activeIndex?: number
  className?: string
}) {
  const [activeInternal, setActiveInternal] = useState(0)
  const active = activeIndexProp !== undefined ? activeIndexProp : activeInternal

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function update() {
      if (!el) return
      const itemW = el.scrollWidth / Math.max(1, count)
      const idx = Math.round(el.scrollLeft / itemW)
      setActiveInternal(Math.min(count - 1, Math.max(0, idx)))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [scrollRef, count])

  function jumpTo(i: number) {
    const el = scrollRef.current
    if (!el) return
    const itemW = el.scrollWidth / Math.max(1, count)
    el.scrollTo({ left: itemW * i, behavior: 'smooth' })
  }

  return (
    <div className={`md:hidden flex justify-center items-center gap-1.5 mt-5 ${className}`} role="tablist">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-label={`Go to slide ${i + 1}`}
          aria-selected={i === active}
          onClick={() => jumpTo(i)}
          className={`h-1.5 rounded-pill transition-all duration-300 ease-out ${
            i === active ? 'w-6 bg-brand-accent' : 'w-1.5 bg-border hover:bg-ink-tertiary'
          }`}
        />
      ))}
    </div>
  )
}
