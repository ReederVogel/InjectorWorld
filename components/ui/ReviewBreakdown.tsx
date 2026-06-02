'use client'

import { useEffect, useRef, useState } from 'react'

type ReviewBreakdownProps = {
  reviews: Array<{ rating: number }>
  aggregateRating?: number
  aggregateRatingCount?: number
}

export function ReviewBreakdown({ reviews, aggregateRating, aggregateRatingCount }: ReviewBreakdownProps) {
  const [animated, setAnimated] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setAnimated(true); observer.disconnect() } },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => Math.round(r.rating) === star).length,
  }))
  const total = reviews.length || 1

  return (
    <div ref={ref} className="flex flex-col md:flex-row gap-6 md:gap-10 items-start">
      {/* Big number */}
      {aggregateRating && (
        <div className="text-center flex-shrink-0">
          <div className="font-serif font-medium text-[4rem] leading-none text-ink-primary">
            {aggregateRating.toFixed(1)}
          </div>
          <div className="star-row text-[18px] mt-1">
            {'★'.repeat(Math.round(aggregateRating))}{'☆'.repeat(5 - Math.round(aggregateRating))}
          </div>
          {aggregateRatingCount && (
            <div className="text-caption text-ink-tertiary mt-1">
              {aggregateRatingCount.toLocaleString()} reviews
            </div>
          )}
        </div>
      )}

      {/* Bar chart */}
      <div className="flex-1 w-full space-y-2">
        {counts.map(({ star, count }) => {
          const pct = Math.round((count / total) * 100)
          return (
            <div key={star} className="flex items-center gap-3">
              <span className="text-body-sm text-ink-secondary w-4 text-right flex-shrink-0">{star}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="rgb(var(--state-star))" className="flex-shrink-0">
                <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
              </svg>
              <div className="flex-1 h-2 rounded-pill bg-border overflow-hidden">
                <div
                  className="h-full rounded-pill bg-state-star transition-all duration-700 ease-out"
                  style={{ width: animated ? `${pct}%` : '0%' }}
                />
              </div>
              <span className="text-caption text-ink-tertiary w-8 text-right flex-shrink-0">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
