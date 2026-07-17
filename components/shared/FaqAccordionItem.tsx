import Link from 'next/link'

const SAFETY_NOTICES: Record<string, { label: string; text: string; tone: 'error' | 'info' }> = {
  'serious-risk': {
    label: 'Serious risk',
    text: 'This treatment carries a risk of serious complications. Discuss your full medical history with a licensed provider before proceeding.',
    tone: 'error',
  },
  'non-fda-approved': {
    label: 'Not FDA-approved',
    text: 'This product is not FDA-approved. Confirm its regulatory status with your provider before treatment.',
    tone: 'info',
  },
}

export function FaqAccordionItem({
  question,
  answer,
  detail,
  offLabel,
  safetyFlag,
  relatedGuideSlug,
  relatedGuideTitle,
}: {
  question: string
  answer: string
  detail?: string
  offLabel?: boolean
  safetyFlag?: string
  relatedGuideSlug?: string
  relatedGuideTitle?: string
}) {
  const safetyNotice = safetyFlag && safetyFlag !== 'none' ? SAFETY_NOTICES[safetyFlag] : undefined

  return (
    <details className="group rounded-xl border border-border bg-surface overflow-hidden">
      <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none select-none hover:bg-surface-canvas transition">
        <span className="font-medium text-body text-ink-primary pr-2">{question}</span>
        <svg
          className="flex-shrink-0 w-5 h-5 text-ink-tertiary group-open:rotate-180 group-open:text-brand-accent transition-transform duration-200"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="px-5 pb-5 pt-3 border-t border-border-subtle text-body-sm text-ink-secondary leading-relaxed space-y-3">
        <p>{answer}</p>
        {detail && <p>{detail}</p>}

        {offLabel && (
          <div className="rounded-lg border border-state-info/20 bg-state-info/5 px-4 py-3 text-caption text-ink-secondary">
            <span className="font-semibold text-state-info">Off-label use. </span>
            This is a recognized and commonly practiced use, but the FDA has not specifically approved it for this purpose. Discuss it with your provider.
          </div>
        )}

        {safetyNotice && (
          <div
            className={`rounded-lg border px-4 py-3 text-caption text-ink-secondary ${
              safetyNotice.tone === 'error'
                ? 'border-state-error/20 bg-state-error/5'
                : 'border-state-info/20 bg-state-info/5'
            }`}
          >
            <span
              className={`font-semibold ${safetyNotice.tone === 'error' ? 'text-state-error' : 'text-state-info'}`}
            >
              {safetyNotice.label}.{' '}
            </span>
            {safetyNotice.text}
          </div>
        )}

        {relatedGuideSlug && (
          <Link
            href={`/guides/${relatedGuideSlug}`}
            className="inline-flex items-center gap-1.5 text-body-sm text-brand-accent font-medium hover:underline"
          >
            Read the full guide{relatedGuideTitle ? `: ${relatedGuideTitle}` : ''}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        )}
      </div>
    </details>
  )
}
