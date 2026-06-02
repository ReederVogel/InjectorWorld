import Link from 'next/link'

export function PreFooterCta() {
  return (
    <section className="bg-[#0B1B34] py-24 md:py-32 px-5 md:px-10 relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 mesh-dark pointer-events-none" />
      <div aria-hidden className="absolute inset-0 dot-grid opacity-30 pointer-events-none" />

      <div className="max-w-[760px] mx-auto text-center relative">
        <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-pill bg-white/5 border border-white/15">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#3FA68A] opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3FA68A]" />
          </span>
          <span className="overline text-[#3FA68A]">Ready when you are</span>
        </div>

        <h2 className="headline-display text-h2-m md:text-display text-white mb-6 text-balance">
          Find a verified injector in your city.
        </h2>

        <p className="font-serif text-lede-m md:text-lede text-white/70 leading-[1.45] mb-10 text-balance max-w-[560px] mx-auto">
          License-verified providers in 200+ US cities. No paid rankings, no algorithmic favors. Just expert-vetted injectors near you.
        </p>

        <Link
          href="/botox/new-york-ny"
          className="group inline-flex items-center gap-3 bg-[#3FA68A] text-white rounded-pill px-8 py-4 text-body font-semibold hover:bg-[#338F76] hover:scale-[1.02] transition-all duration-300 shadow-[0_12px_40px_rgba(63,166,138,0.35)]"
        >
          Find an injector near you
          <span className="inline-flex w-7 h-7 rounded-pill bg-white/20 items-center justify-center transition-transform duration-300 group-hover:translate-x-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </Link>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-12 text-caption text-white/55 uppercase tracking-wider font-semibold">
          <span className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#3FA68A]" />12,400+ verified injectors</span>
          <span className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#3FA68A]" />Zero paid placements</span>
          <span className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#3FA68A]" />4 years independent</span>
        </div>
      </div>
    </section>
  )
}
