'use client'

import { useState } from 'react'
import { ReviewBreakdown } from '@/components/ui/ReviewBreakdown'
import type { ClinicReviewRow } from '@/lib/clinic-queries'

const VERIFIED_REVIEW_SOURCES = new Set(['first-party', 'provider-collected'])

export function ClinicReviews({
  reviews,
  aggregateRating,
  aggregateRatingCount,
}: {
  reviews: ClinicReviewRow[]
  aggregateRating?: number
  aggregateRatingCount?: number
}) {
  const [visible, setVisible] = useState(5)
  const shown = reviews.slice(0, visible)

  if (reviews.length === 0) return null

  return (
    <section>
      <h2 className="mb-6 font-serif text-h3 text-ink-primary">Patient reviews</h2>
      <div className="mb-6 rounded-2xl border border-border bg-surface p-5">
        <ReviewBreakdown
          reviews={reviews}
          aggregateRating={aggregateRating}
          aggregateRatingCount={aggregateRatingCount}
        />
      </div>
      <div className="space-y-5">
        {shown.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
      {visible < reviews.length && (
        <button
          type="button"
          onClick={() => setVisible((current) => Math.min(current + 5, reviews.length))}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-pill border border-border px-5 py-2.5 text-body-sm font-semibold text-ink-primary transition hover:border-brand-accent hover:bg-surface"
        >
          Load more reviews
        </button>
      )}
      {/* TODO: Add "Be the first to review" CTA after the review submission flow ships. */}
    </section>
  )
}

function ReviewCard({ review }: { review: ClinicReviewRow }) {
  const stars = Math.max(0, Math.min(5, Math.round(review.rating)))
  const date = review.reviewDate
    ? new Date(review.reviewDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : ''
  const canShowVerified = review.verified && VERIFIED_REVIEW_SOURCES.has(review.sourcePlatform)

  return (
    <article className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-body-sm text-ink-primary">
              {review.reviewerFirstName || 'Patient'}{review.reviewerInitial ? ` ${review.reviewerInitial}.` : ''}
            </span>
            {canShowVerified && (
              <span className="rounded-pill bg-brand-accent-soft px-2.5 py-0.5 text-[10px] font-semibold text-brand-accent">
                Verified review
              </span>
            )}
          </div>
          {date && <p className="mt-1 text-caption text-ink-tertiary">{date}</p>}
        </div>
        <div className="star-row shrink-0 text-[12px] text-state-star">
          {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
        </div>
      </div>
      {review.reviewTitle && (
        <p className="mb-1.5 font-semibold text-body-sm text-ink-primary">{review.reviewTitle}</p>
      )}
      <p className="text-body-sm leading-relaxed text-ink-secondary">{review.reviewText}</p>
      {review.treatmentTag && (
        <p className="mt-3 text-caption text-ink-tertiary">{review.treatmentTag}</p>
      )}
    </article>
  )
}
