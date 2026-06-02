import Link from 'next/link'
import type { TreatmentRow } from '@/lib/home-queries'

const iconPaths: Record<string, string> = {
  neurotoxin: 'M12 2v20M2 12h20',
  filler: 'M12 21c-2-3-7-6-7-11a5 5 0 0110 0c0 5-5 8-7 11z',
  biostimulator: 'M12 3l9 18H3z',
  skin: 'M3 12c4-3 14-3 18 0M3 16c4-3 14-3 18 0',
  thread: 'M4 12c4-8 12-8 16 0',
  body: 'M6 16c2 0 6-2 6-6M18 8c-2 0-6 2-6 6',
  other: 'M12 2v6M12 22v-6M2 12h6M22 12h-6',
}

export function BrowseTreatments({ treatments }: { treatments: TreatmentRow[] }) {
  return (
    <section className="bg-surface-canvas py-16 md:py-24 border-t border-border-subtle">
      <div className="max-canvas">
        <div className="max-w-[640px] mb-10 md:mb-12">
          <h2 className="headline-display text-h2-m md:text-h2 text-ink-primary mb-2">Treatments.</h2>
          <p className="font-serif text-[20px] md:text-[24px] leading-[1.3] text-ink-secondary font-normal">What are you considering?</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {treatments.map((t) => (
            <div key={t.id} className="group relative bg-surface-warm rounded-xl p-5 md:p-6 transition hover:shadow-md hover:-translate-y-0.5">
              <div className="w-9 h-9 rounded-lg bg-surface-canvas flex items-center justify-center mb-4 group-hover:bg-brand-accent transition">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-primary group-hover:text-surface-canvas transition">
                  <path d={iconPaths[t.category] ?? iconPaths.other} />
                </svg>
              </div>
              <Link href={`/${t.slug}`} className="block font-semibold text-body text-ink-primary mb-1 hover:text-brand-accent">{t.name}</Link>
              {t.tagline && <p className="text-caption text-ink-tertiary leading-snug mb-3 line-clamp-2">{t.tagline}</p>}
              <div className="space-y-1 text-caption">
                <Link href={`/guides/${t.slug}`} className="block text-brand-accent font-medium hover:underline">Read the guide &rarr;</Link>
                <Link href={`/${t.slug}/new-york-ny`} className="block text-brand-accent font-medium hover:underline">Find a provider &rarr;</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
