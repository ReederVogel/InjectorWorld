import { getHeroData } from '@/lib/hero-queries'
import { HeroSearch } from './HeroSearch'

export async function Hero() {
  const { providers } = await getHeroData()

  return (
    <section className="relative overflow-hidden flex flex-col justify-center min-h-[100dvh] px-5 md:px-10 py-10 md:py-14 bg-surface-canvas">
      {/* Subtle radial accents */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50" style={{
        backgroundImage:
          'radial-gradient(circle at 12% 10%, rgba(63,166,138,0.08) 0%, transparent 35%),' +
          'radial-gradient(circle at 88% 8%, rgba(245,158,11,0.06) 0%, transparent 35%)',
      }} />

      <div className="relative max-w-canvas mx-auto w-full">
        {/* The "Ask anything" AI teaser that used to sit here was retired
            2026-08-05 -- the floating Chat button (AssistantWidget) is now the
            only AI entry point. The section is now min-h-[100dvh] with vertical
            centering (rather than natural top-anchored height) so the next
            section never peeks in half-cut at the bottom of the first fold.
            That freed-up space made the compacted 2026-07-31 headline size
            (4.5rem desktop) look small and lost, so it's back up to 5.5rem
            (desktop) / display-m (mobile), same day. */}
        <div className="text-center max-w-[920px] mx-auto mb-5 md:mb-6">
          <h1 className="headline-display text-display-m md:text-[5.5rem] text-ink-primary mb-4">
            Find Your Injector.
          </h1>
          <p className="headline-display text-lede-m md:text-[1.75rem] text-ink-secondary">
            Every Treatment. Every Brand. Every Injectable.
            <br />
            Right Here. Right Now.
          </p>
        </div>

        <HeroSearch providers={providers} />
      </div>
    </section>
  )
}
