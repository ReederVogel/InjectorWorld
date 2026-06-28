import Link from 'next/link'
import { Syringe, Eye, Drop, Sparkle, DotsNine, ArrowUp, ArrowRight, Plant, TestTube } from '@phosphor-icons/react/dist/ssr'
import type { TreatmentRow } from '@/lib/home-queries'

type PhosphorProps = { size?: number; weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'; className?: string }

function TreatmentIcon({ iconSlug, ...props }: { iconSlug?: string } & PhosphorProps) {
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

export function BrowseTreatments({ treatments }: { treatments: TreatmentRow[] }) {
  return (
    <section className="bg-surface-canvas py-16 md:py-24 border-t border-border-subtle">
      <div className="max-canvas">
        <div className="max-w-[640px] mb-10 md:mb-12">
          <h2 className="headline-display text-h2-m md:text-h2 text-ink-primary mb-1">Browse by service</h2>
          <p className="text-overline uppercase tracking-widest text-brand-accent mb-3">What are you considering?</p>
          <p className="font-serif text-[20px] md:text-[22px] leading-[1.4] text-ink-secondary font-normal">
            Every service, explained. Find verified providers for each.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {treatments.map((t, index) => {
            const isFeatured = index === 0
            const categoryLabel = CATEGORY_LABELS[t.category] ?? t.category
            const isWarm = index % 3 === 1

            return (
              <Link
                key={t.id}
                href={`/services/${t.slug}`}
                className={[
                  'group relative flex flex-col rounded-xl border transition-all duration-200',
                  'hover:shadow-hover hover:-translate-y-[3px] hover:border-brand-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent',
                  isFeatured
                    ? 'lg:col-span-2 bg-surface-warm border-border-default p-6 md:p-8'
                    : isWarm
                      ? 'bg-surface-warm border-border-subtle p-5 md:p-6'
                      : 'bg-surface-canvas border-border-subtle p-5 md:p-6',
                ].join(' ')}
              >
                {/* Category overline */}
                <p className="text-overline uppercase text-brand-accent mb-3 flex-shrink-0">
                  {categoryLabel}
                </p>

                {/* Icon */}
                <div
                  className={[
                    'rounded-md bg-brand-accent-soft flex items-center justify-center flex-shrink-0 mb-4 transition-transform duration-200 group-hover:scale-110',
                    isFeatured ? 'w-12 h-12' : 'w-10 h-10',
                  ].join(' ')}
                >
                  <TreatmentIcon
                    iconSlug={t.iconSlug}
                    size={isFeatured ? 24 : 20}
                    weight="regular"
                    className="text-brand-accent"
                  />
                </div>

                {/* Name + tagline */}
                <div className="flex-1">
                  <p className={['font-semibold text-ink-primary mb-1', isFeatured ? 'text-h4' : 'text-body'].join(' ')}>
                    {t.name}
                  </p>
                  {t.tagline && (
                    <p className="text-caption text-ink-tertiary leading-snug line-clamp-2">{t.tagline}</p>
                  )}
                </div>

                {/* Ghost pill CTA */}
                <div className="mt-4 pt-3 border-t border-border-subtle flex-shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill border border-ink-primary/25 text-caption text-ink-secondary font-semibold group-hover:border-brand-accent group-hover:text-brand-accent transition-all duration-200">
                    Find providers
                    <ArrowRight
                      size={11}
                      weight="bold"
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
