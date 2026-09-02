import { HeroSearch } from './HeroSearch'

export function Hero({ children }: { children?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden flex flex-col justify-center min-h-dvh px-5 md:px-10 py-10 md:py-12 bg-surface-canvas">
      {/* Subtle radial accents */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50" style={{
        backgroundImage:
          'radial-gradient(circle at 12% 10%, rgba(63,166,138,0.08) 0%, transparent 35%),' +
          'radial-gradient(circle at 88% 8%, rgba(245,158,11,0.06) 0%, transparent 35%)',
      }} />

      <div className="relative max-w-canvas mx-auto w-full">
        {/* The "Ask anything" AI teaser that used to sit here was retired
            2026-08-05 -- the floating Chat button (AssistantWidget) is now the
            only AI entry point. The section is min-h-dvh with vertical
            centering (rather than natural top-anchored height) so the next
            section does not peek in half-cut at the bottom of the first fold.
            It was min-h-[88dvh] until 2026-09-03: the 12dvh of slack existed
            only to close the dead band above the trust bar, and the trust bar
            now lives INSIDE this section, so the fold has to hold the full
            headline + search + stat row. For the same reason the headline is
            back to the compacted 4.5rem (it had been raised to 5.5rem when the
            fold had space to spare). */}
        <div className="text-center max-w-[920px] mx-auto mb-5 md:mb-6">
          {/* Mobile stays on h1-m: display-m (46px) wrapped "Find Your
              Injector." onto two lines at 390px. Desktop is 4.5rem. */}
          <h1 className="headline-display text-h1-m md:text-[4.5rem] text-ink-primary mb-4">
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

        <HeroSearch />

        {/* Trust bar, passed in from the homepage rather than imported here:
            it is an async server component that hits the DB, and Hero itself
            stays a plain synchronous component. Moved into the fold on
            2026-09-03 (client request). */}
        {children && <div className="mt-8 md:mt-10">{children}</div>}
      </div>
    </section>
  )
}
