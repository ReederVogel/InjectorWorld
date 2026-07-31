import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import type { ServiceRow } from '@/lib/home-queries'

export function BrowseServices({ treatments }: { treatments: ServiceRow[] }) {
  return (
    <section className="bg-surface-canvas py-16 md:py-24 border-t border-border-subtle">
      <div className="max-canvas">
        <div className="max-w-[640px] mb-10 md:mb-12">
          {/* Renamed from "Browse by service" 2026-07-31 (client request). */}
          <h2 className="headline-display text-h2-m md:text-h2 text-ink-primary mb-1">Search By Service/Treatment</h2>
          <p className="text-overline uppercase tracking-widest text-brand-accent mb-3">What are you considering?</p>
          <p className="font-serif text-[20px] md:text-[22px] leading-[1.4] text-ink-secondary font-normal">
            Every service, explained. Find verified providers for each.
          </p>
        </div>

        {/* Compact card layout (client request 2026-07-31): the section was eating
            too much vertical space, so the oversized featured card is gone and the
            grid is even. Second pass the same day: the sparkle icon and the
            category overline ("INJECTABLE", "SKIN", "BODY-AREA") were both dropped,
            and "Find providers" became a real bordered button at body-sm rather
            than a 12px text link. Third pass: the tagline line was dropped too.
            Only some services carry one, so cards came out uneven. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {treatments.map((t, index) => {
            const isWarm = index % 3 === 1

            return (
              <Link
                key={t.id}
                href={`/services/${t.slug}`}
                className={[
                  'group relative flex flex-col rounded-control border p-4 transition-all duration-200',
                  'hover:shadow-hover hover:-translate-y-[3px] hover:border-brand-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent',
                  isWarm ? 'bg-surface-warm border-border-subtle' : 'bg-surface-canvas border-border-subtle',
                ].join(' ')}
              >
                <p className="font-semibold text-ink-primary text-body leading-snug">
                  {t.name}
                </p>

                <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-control border border-border px-3 py-2 text-body-sm font-semibold text-ink-primary bg-surface-canvas group-hover:border-brand-accent group-hover:text-brand-accent transition-colors duration-200">
                  Find providers
                  <ArrowRight
                    size={14}
                    weight="bold"
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
