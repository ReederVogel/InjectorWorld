import Link from 'next/link'
import { Syringe, Eye, Drop, Sparkle, DotsNine, ArrowUp, ArrowRight, Plant, TestTube } from '@phosphor-icons/react/dist/ssr'
import type { ServiceRow } from '@/lib/home-queries'

type PhosphorProps = { size?: number; weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'; className?: string }

function ServiceIcon({ iconSlug, ...props }: { iconSlug?: string } & PhosphorProps) {
  switch (iconSlug) {
    case 'syringe':
    case 'jaw':
    case 'jawline':
    case 'face':
      return <Syringe {...props} />
    case 'lips':
    case 'drop':
      return <Drop {...props} />
    case 'eye':
      return <Eye {...props} />
    case 'dots':
      return <DotsNine {...props} />
    case 'thread':
      return <ArrowUp {...props} />
    case 'collagen':
      return <Plant {...props} />
    case 'chin':
      return <TestTube {...props} />
    default:
      return <Sparkle {...props} />
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  neurotoxin: 'Neurotoxin',
  filler: 'Dermal Filler',
  biostimulator: 'Biostimulator',
  skin: 'Skin',
  thread: 'Thread',
  body: 'Body',
  other: 'Injectable',
}

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

        {/* Compact card layout (client request 2026-07-31): the section was
            eating too much vertical space. The icon now sits beside the label
            instead of stacked above it, the divider + button block is gone, and
            the oversized featured card is dropped so the grid is even. This
            roughly halves each card's height. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {treatments.map((t, index) => {
            const categoryLabel = CATEGORY_LABELS[t.category] ?? t.category
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
                <div className="flex items-start gap-2.5">
                  <span className="rounded-control bg-brand-accent-soft flex items-center justify-center flex-shrink-0 w-8 h-8 transition-transform duration-200 group-hover:scale-110">
                    <ServiceIcon iconSlug={t.iconSlug} size={17} weight="regular" className="text-brand-accent" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-overline uppercase text-brand-accent leading-tight">
                      {categoryLabel}
                    </span>
                    <span className="block font-semibold text-ink-primary text-body-sm leading-snug">
                      {t.name}
                    </span>
                  </span>
                </div>

                {t.tagline && (
                  <p className="text-caption text-ink-tertiary leading-snug mt-2 line-clamp-1">{t.tagline}</p>
                )}

                <span className="mt-2.5 inline-flex items-center gap-1 text-caption font-semibold text-ink-secondary group-hover:text-brand-accent transition-colors duration-200">
                  Find providers
                  <ArrowRight
                    size={11}
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
