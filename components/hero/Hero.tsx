import { getHeroData } from '@/lib/hero-queries'
import { HeroSearch } from './HeroSearch'
import { AiSearchTeaser } from './AiSearchTeaser'

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
        <div className="text-center max-w-[920px] mx-auto mb-8 md:mb-10">
          <h1 className="headline-display text-h1-m md:text-display text-ink-primary mb-6">
            Find a verified injector<br className="hidden md:inline" />
            <span className="md:hidden"> </span>you can actually trust.
          </h1>
        </div>

        <AiSearchTeaser />

        <HeroSearch providers={providers} />
      </div>
    </section>
  )
}
