import { CountUp } from './CountUp'

export function TrustBar() {
  return (
    <section className="bg-surface py-20 md:py-28 px-5 md:px-10 border-y border-border-subtle">
      <div className="max-canvas">
        <div className="text-center max-w-[640px] mx-auto mb-12 md:mb-16">
          <h2 className="headline-display text-h2-m md:text-h2 text-ink-primary mb-2">The numbers.</h2>
          <p className="font-serif text-[20px] md:text-[24px] leading-[1.3] text-ink-secondary font-normal">Every number is sourced and updated monthly.</p>
        </div>

        {/* Top row: 2 large cards with watermark numbers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-4 md:mb-5">
          <BigStatCard
            accent="#F59E0B"
            value={12400}
            display={<><CountUp to={12400} format="comma" /><span className="text-brand-accent">+</span></>}
            label="Verified Injectors"
            sub="patients who trust us every month"
            live
          />
          <BigStatCard
            accent="#3FA68A"
            value={87000}
            display={<><CountUp to={87000} format="comma" /><span className="text-brand-accent">+</span></>}
            label="Patient Reviews"
            sub="verified stories published and updated"
          />
        </div>

        {/* Bottom row: 4 smaller cards with left accent */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          <SmallStatCard accent="#3B82F6" value={<><CountUp to={200} format="plain" /><span className="text-brand-accent">+</span></>} title="Cities Covered" sub="across all 50 US states" />
          <SmallStatCard accent="#A855F7" value={<><CountUp to={30} format="plain" /><span className="text-brand-accent">+</span></>} title="Treatment Guides" sub="medically reviewed" />
          <SmallStatCard accent="#F97316" value={<CountUp to={16} format="plain" />} title="Medical Reviewers" sub="board-certified MDs on advisory" />
          <SmallStatCard accent="#EF4444" value={<><CountUp to={4} format="plain" /><span className="text-state-error text-[24px] md:text-[28px] ml-1 font-medium align-middle">yrs</span></>} title="Years Independent" sub="zero paid placements" />
        </div>
      </div>
    </section>
  )
}

function BigStatCard({
  accent, value, display, label, sub, live,
}: { accent: string; value: number; display: React.ReactNode; label: string; sub: string; live?: boolean }) {
  const watermark = value.toLocaleString('en-US') + '+'
  return (
    <div className="relative overflow-hidden bg-surface-canvas rounded-2xl border border-border shadow-sm p-7 md:p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-hover cursor-default">
      <span className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: accent }} aria-hidden />
      {live && (
        <span className="absolute top-5 right-5 inline-flex items-center gap-2 text-caption font-semibold tracking-wider uppercase text-brand-accent">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent" />
          </span>
          LIVE
        </span>
      )}
      <span aria-hidden className="absolute -bottom-6 -right-4 font-serif text-[140px] md:text-[180px] leading-none font-semibold opacity-[0.06] text-ink-primary whitespace-nowrap pointer-events-none">
        {watermark}
      </span>
      <div className="relative">
        <div className="font-serif text-[56px] md:text-[72px] leading-[0.95] font-medium text-ink-primary mb-4">{display}</div>
        <div className="text-body font-semibold text-ink-primary mb-1">{label}</div>
        <div className="text-body-sm text-ink-secondary">{sub}</div>
      </div>
    </div>
  )
}

function SmallStatCard({ accent, value, title, sub }: { accent: string; value: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="relative bg-surface-canvas rounded-xl border border-border shadow-sm p-5 md:p-6 pl-6 md:pl-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-hover cursor-default">
      <span className="absolute top-3 bottom-3 left-0 w-1 rounded-r-pill" style={{ backgroundColor: accent }} aria-hidden />
      <div className="font-serif text-[36px] md:text-[42px] leading-none font-medium text-ink-primary mb-3">{value}</div>
      <div className="text-body-sm font-semibold text-ink-primary mb-0.5">{title}</div>
      <div className="text-caption text-ink-tertiary leading-snug">{sub}</div>
    </div>
  )
}
