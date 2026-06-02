'use client'

import Link from 'next/link'
import { useRef } from 'react'
import type { BeforeAfterRow } from '@/lib/home-queries'
import { BeforeAfterSlider } from './BeforeAfterSlider'
import { CarouselDots } from '@/components/ui/CarouselDots'

export function PatientStoriesClient({ cases }: { cases: BeforeAfterRow[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  return (
    <>
      <div
        ref={scrollRef}
        className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 overflow-x-auto snap-x snap-mandatory hide-scrollbar -mx-5 md:mx-0 px-5 md:px-0 pb-2"
      >
        {cases.map((c) => (
          <article
            key={c.id}
            className="card-premium flex-shrink-0 w-[300px] md:w-auto snap-start bg-surface-canvas border border-border rounded-2xl overflow-hidden"
          >
            <BeforeAfterSlider beforeUrl={c.beforePhotoUrl} afterUrl={c.afterPhotoUrl} alt={c.caseTitle} />

            <div className="p-5">
              {/* Tags row */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] px-2.5 py-1 rounded-pill bg-brand-accent-soft text-brand-primary font-semibold uppercase tracking-wider">
                  {c.treatmentTag}
                </span>
                <span className="text-caption text-ink-tertiary">{c.weeksPost} weeks post</span>
              </div>

              {/* Case title */}
              <p className="font-serif text-[16px] leading-[1.4] text-ink-primary font-medium mb-3">
                {c.caseTitle}
              </p>

              {/* Provider */}
              <div className="text-body-sm text-ink-primary mb-1">
                Treated by{' '}
                {c.provider?.slug ? (
                  <Link
                    href={`/injectors/${c.provider.slug}`}
                    className="font-medium text-brand-accent hover:underline"
                  >
                    {c.provider.fullName}
                  </Link>
                ) : (
                  <span className="font-medium">{c.provider?.fullName ?? 'Verified provider'}</span>
                )}
              </div>
              <div className="text-caption text-ink-tertiary">{c.city}, {c.state}</div>
            </div>
          </article>
        ))}
      </div>
      <CarouselDots scrollRef={scrollRef} count={cases.length} />
    </>
  )
}
