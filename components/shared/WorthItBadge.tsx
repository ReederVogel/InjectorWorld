import type { WorthItResult } from '@/lib/worth-it'

type Props = {
  result: WorthItResult
  treatmentName?: string
  size?: 'sm' | 'md'
}

export function WorthItBadge({ result, treatmentName, size = 'md' }: Props) {
  if (!result.hasData) return null

  const isSm = size === 'sm'

  return (
    <div
      className={`inline-flex flex-col rounded-xl border border-border bg-surface ${isSm ? 'px-3 py-2' : 'px-4 py-3'}`}
      aria-label={`${result.score}% of patients say ${treatmentName || 'this treatment'} was worth it`}
    >
      <div className="flex items-baseline gap-1">
        <span className={`font-bold text-brand-accent leading-none ${isSm ? 'text-[22px]' : 'text-[28px]'}`}>
          {result.score}%
        </span>
        <span className={`text-ink-tertiary ${isSm ? 'text-caption' : 'text-body-sm'}`}>Worth It</span>
      </div>
      <div className={`text-ink-tertiary mt-0.5 ${isSm ? 'text-[10px]' : 'text-caption'}`}>
        Based on {result.sampleSize.toLocaleString()} verified {result.sampleSize === 1 ? 'review' : 'reviews'}
      </div>
    </div>
  )
}
