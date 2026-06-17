import { getHeroData } from '@/lib/hero-queries'
import { HeroSearch } from './HeroSearch'

export async function Hero() {
  const { providers } = await getHeroData()

  return (
    <section className="relative overflow-hidden px-5 md:px-10 pt-16 md:pt-28 pb-10 md:pb-16 bg-surface-canvas">
      {/* Subtle radial accents */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50" style={{
        backgroundImage:
          'radial-gradient(circle at 12% 10%, rgba(63,166,138,0.08) 0%, transparent 35%),' +
          'radial-gradient(circle at 88% 8%, rgba(245,158,11,0.06) 0%, transparent 35%)',
      }} />

      <div className="relative max-w-canvas mx-auto">
        <div className="text-center max-w-[920px] mx-auto mb-12 md:mb-14">
          <h1 className="headline-display text-h1-m md:text-display text-ink-primary mb-6">
            Find a verified injector<br className="hidden md:inline" />
            <span className="md:hidden"> </span>you can actually trust.
          </h1>

          <p className="font-serif text-lede-m md:text-lede text-ink-secondary leading-[1.45] max-w-[720px] mx-auto text-balance">
            Every injector on injector.world is license-verified, credential-reviewed, and rated by real patients.
          </p>
        </div>

        <HeroSearch providers={providers} />

        {/* Quick credibility row */}
        <div className="mt-14 md:mt-20 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-caption text-ink-tertiary uppercase tracking-wider font-semibold">
          <span>Medically reviewed by</span>
          {['ABMS', 'AAD', 'ASPS', 'ASDS'].map((org) => (
            <span key={org} className="text-ink-secondary">{org}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
