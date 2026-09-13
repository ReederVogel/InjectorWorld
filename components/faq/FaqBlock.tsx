import Link from 'next/link'
import { FaqAccordionItem } from '@/components/shared/FaqAccordionItem'
import type { FaqRow, FaqSeeAll } from '@/lib/faqs/queries'

/**
 * The FAQ preview on treatment, brand, guide and place pages: a few questions
 * plus a link to the category page that holds all of them.
 *
 * Deliberately emits no FAQPage schema. The category page (/faq/<slug>) is the
 * one place that carries it; see docs/FAQ-SYSTEM-2026-09-13.md.
 */
export function FaqBlock({
  faqs,
  seeAll,
  heading = 'Frequently asked questions',
  headingClassName = 'font-serif text-h2 text-ink-primary mb-5',
  listClassName = 'space-y-2 max-w-3xl',
  className,
}: {
  faqs: FaqRow[]
  seeAll?: FaqSeeAll | null
  heading?: string
  headingClassName?: string
  listClassName?: string
  className?: string
}) {
  if (faqs.length === 0) return null

  return (
    <div className={className}>
      <h2 className={headingClassName}>{heading}</h2>
      <div className={listClassName}>
        {faqs.map((f) => (
          <FaqAccordionItem
            key={f.id}
            question={f.question}
            answer={f.answer}
            detail={f.detail}
            offLabel={f.offLabel}
            safetyFlag={f.safetyFlag}
            relatedGuideSlug={f.relatedGuideSlug}
            relatedGuideTitle={f.relatedGuideTitle}
          />
        ))}
      </div>
      {seeAll && (
        <Link
          href={seeAll.href}
          className="mt-4 inline-flex items-center gap-1.5 text-body-sm font-semibold text-ink-primary underline decoration-border underline-offset-4 transition hover:decoration-ink-primary"
        >
          {seeAll.label}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      )}
    </div>
  )
}
