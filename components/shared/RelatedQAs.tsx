import Link from 'next/link'
import type { QAItem } from '@/lib/qa-queries'

type Props = {
  qas: QAItem[]
  treatmentName?: string
  cityName?: string
}

export function RelatedQAs({ qas, treatmentName, cityName }: Props) {
  if (qas.length === 0) return null

  const context = treatmentName || cityName || 'this topic'

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-5">
        <h2 className="font-serif text-h2 text-ink-primary">Q&A about {context}</h2>
        <Link href="/questions" className="text-body-sm text-brand-accent font-medium hover:underline flex-shrink-0">
          See all Q&A
        </Link>
      </div>
      <div className="space-y-3">
        {qas.map((q) => (
          <Link
            key={q.id}
            href={`/questions/${q.slug}`}
            className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface hover:border-brand-accent hover:bg-surface-warm transition-all group"
          >
            <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-brand-accent-soft flex items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><circle cx="12" cy="17" r="0.5" fill="currentColor" />
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-body-sm text-ink-primary group-hover:text-brand-accent transition leading-snug mb-1">
                {q.questionTitle}
              </div>
              <p className="text-caption text-ink-tertiary line-clamp-1">
                {q.answeredByProvider?.fullName || q.answeredByName || 'injector.world editorial'}
              </p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-1 text-ink-tertiary group-hover:text-brand-accent transition">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  )
}
