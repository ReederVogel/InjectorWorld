import Link from 'next/link'
import { Syringe, Eye, Drop, Sparkle, DotsNine, ArrowUp } from '@phosphor-icons/react/dist/ssr'
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
    default:
      return <Sparkle {...props} />
  }
}

export function BrowseTreatments({ treatments }: { treatments: TreatmentRow[] }) {
  return (
    <section className="bg-surface-canvas py-16 md:py-24 border-t border-border-subtle">
      <div className="max-canvas">
        <div className="max-w-[640px] mb-10 md:mb-12">
          <h2 className="headline-display text-h2-m md:text-h2 text-ink-primary mb-2">Treatments.</h2>
          <p className="font-serif text-[20px] md:text-[24px] leading-[1.3] text-ink-secondary font-normal">
            What are you considering?
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {treatments.map((t) => (
            <div
              key={t.id}
              className="group relative bg-surface-warm rounded-xl p-5 md:p-6 flex flex-col transition-all duration-200 hover:shadow-hover hover:-translate-y-0.5"
            >
              <div className="w-9 h-9 rounded-lg bg-surface-canvas flex items-center justify-center mb-4 group-hover:bg-brand-accent transition-colors duration-200 flex-shrink-0">
                <TreatmentIcon
                  iconSlug={t.iconSlug}
                  size={18}
                  weight="regular"
                  className="text-ink-primary group-hover:text-white transition-colors duration-200"
                />
              </div>

              <div className="flex-1">
                <p className="font-semibold text-body text-ink-primary mb-1">{t.name}</p>
                {t.tagline && (
                  <p className="text-caption text-ink-tertiary leading-snug line-clamp-2">{t.tagline}</p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-border-subtle space-y-2">
                <Link
                  href={`/guides/${t.slug}`}
                  className="block text-caption text-ink-secondary font-medium hover:text-brand-accent transition-colors"
                >
                  Read the guide &rarr;
                </Link>
                <Link
                  href={`/${t.slug}/new-york-ny`}
                  className="flex items-center justify-center w-full px-3 py-2 rounded-pill bg-ink-primary text-white text-caption font-semibold hover:opacity-85 transition-opacity duration-200"
                >
                  Find a provider
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
