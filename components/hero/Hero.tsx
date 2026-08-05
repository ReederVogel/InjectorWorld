import { getHeroData } from '@/lib/hero-queries'
import { HeroSearch } from './HeroSearch'

export async function Hero() {
  const { providers } = await getHeroData()

  return (
    <section className="relative overflow-hidden flex flex-col justify-center min-h-[88dvh] px-5 md:px-10 py-10 md:py-12 bg-surface-canvas">
      {/* Subtle radial accents */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50" style={{
        backgroundImage:
          'radial-gradient(circle at 12% 10%, rgba(63,166,138,0.08) 0%, transparent 35%),' +
          'radial-gradient(circle at 88% 8%, rgba(245,158,11,0.06) 0%, transparent 35%)',
      }} />

      <div className="relative max-w-canvas mx-auto w-full">
        {/* The "Ask anything" AI teaser that used to sit here was retired
            2026-08-05 -- the floating Chat button (AssistantWidget) is now the
            only AI entry point. The section is min-h-[88dvh] with vertical
            centering (rather than natural top-anchored height) so the next
            section does not peek in half-cut at the bottom of the first fold.
            88 rather than 100: at a full viewport the centred block left a
            dead band above the trust bar that read as a layout gap.
            That freed-up space also made the compacted 2026-07-31 headline
            (4.5rem desktop) look small, so desktop is back up to 5.5rem. */}
        <div className="text-center max-w-[920px] mx-auto mb-5 md:mb-6">
          {/* Mobile stays on h1-m: display-m (46px) wrapped "Find Your
              Injector." onto two lines at 390px. Desktop is 5.5rem. */}
          <h1 className="headline-display text-h1-m md:text-[5.5rem] text-ink-primary mb-4">
            Find Your Injector.
          </h1>
          {/* Two separate line structures rather than one auto-wrapping string:
              at 350px of mobile content width the first sentence cannot fit on
              one line, and letting it wrap on its own split it mid-phrase
              ("... Every / Injectable."). Explicit breaks put every break on a
              sentence boundary instead. */}
          <p className="headline-display text-lede-m md:text-[1.75rem] text-ink-secondary">
            <span className="md:hidden">
              Every Treatment. Every Brand.
              <br />
              Every Injectable.
              <br />
              Right Here. Right Now.
            </span>
            <span className="hidden md:inline">
              Every Treatment. Every Brand. Every Injectable.
              <br />
              Right Here. Right Now.
            </span>
          </p>
        </div>

        <HeroSearch providers={providers} />
      </div>
    </section>
  )
}
