import type { ClinicBeforeAfter } from '@/lib/clinic-queries'
import { weeksLabel } from '@/lib/before-after'

/**
 * Approved before/after pairs on a clinic page. Rendered as a <section> so the
 * page's left-column rules (hairline + spacing) apply. Images are plain lazy
 * <img>: each is a single 1080px WebP already sized at upload.
 */
export function BeforeAfterGallery({ clinicName, cases }: { clinicName: string; cases: ClinicBeforeAfter[] }) {
  return (
    <section>
      <h2 className="mb-2 font-serif text-h3 text-ink-primary">Before and after</h2>
      <p className="mb-6 max-w-[60ch] text-body-sm text-ink-secondary">
        Patients of {clinicName}, shared with their written consent. Individual results vary.
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        {cases.map((c) => (
          <figure key={c.id}>
            <div className="grid grid-cols-2 gap-2">
              {(['before', 'after'] as const).map((side) => (
                <div key={side} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={side === 'before' ? c.beforeUrl : c.afterUrl}
                    alt={`${side === 'before' ? 'Before' : 'After'} ${c.treatment} at ${clinicName}`}
                    width={540}
                    height={540}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full rounded-control border border-border object-cover"
                  />
                  <span className="absolute left-2 top-2 rounded-control bg-black/55 px-2 py-0.5 text-caption font-semibold text-white">
                    {side === 'before' ? 'Before' : 'After'}
                  </span>
                </div>
              ))}
            </div>
            <figcaption className="mt-2.5 text-body-sm">
              <span className="font-medium text-ink-primary">{c.treatment}</span>
              <span className="text-ink-tertiary"> · {weeksLabel(c.weeks)}</span>
              {c.note && <span className="mt-0.5 block text-ink-secondary">{c.note}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
