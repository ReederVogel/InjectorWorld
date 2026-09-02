import { getPayloadInstance } from '@/lib/payload-server'
import { CountUp } from './CountUp'

export async function TrustBar() {
  const payload = await getPayloadInstance()
  const pool = (payload.db as any).pool
  const row = await pool
    .query(`
      SELECT
        (SELECT COUNT(*)::int FROM clinics) AS clinic_count,
        (SELECT COUNT(*)::int FROM locations WHERE kind IN ('city','metro')) AS city_count,
        (SELECT COUNT(*)::int FROM brands) AS brand_count
    `)
    .then((r: any) => r.rows[0])
    .catch(() => ({ clinic_count: 0, city_count: 0, brand_count: 0 }))

  const clinicCount = Number(row.clinic_count) || 0
  const cityCount = Number(row.city_count) || 0
  const brandCount = Number(row.brand_count) || 0

  return (
    // No section padding and no border-y as of 2026-09-03: this now renders
    // inside the hero fold, where its own vertical padding stacked on the
    // hero's and the top/bottom rules cut the fold in half.
    <div className="w-full">
      {/* max-w-[900px] is not arbitrary: it is HeroSearch's own wrapper width
          (components/hero/HeroSearch.tsx). The stat row is meant to line up
          edge-to-edge with the search bar above it (client request
          2026-09-03), so if that width ever changes, change it here too. */}
      <div className="max-w-[900px] mx-auto">
        {/* Heading + subtext removed 2026-07-30 (client request): the stat cards
            carry their own labels, so "The numbers." was redundant. The section
            now opens straight on the cards. */}

        {/* Three stats only (client request 2026-07-31). The second row of small
            cards was removed: "Treatment Guides", "Metro Markets" and "Years
            Independent". "Metro Markets: 20" also directly contradicted the
            "Markets Covered" figure sitting right above it. */}
        {/* All three accent rules are mint (client request 2026-08-06). They
            used to be navy / mint / navy. */}
        {/* 3-up on mobile too as of 2026-09-03. Stacked single-column, the
            three cards added ~300px and pushed the search out of the fold. */}
        <div className="grid grid-cols-3 gap-2 md:gap-5">
          <BigStatCard
            accent="#3FA68A"
            display={<><CountUp to={clinicCount} format="comma" /><span className="text-brand-accent">+</span></>}
            label="Clinics Listed"
            live
          />
          <BigStatCard
            accent="#3FA68A"
            display={<><CountUp to={brandCount} format="comma" /><span className="text-brand-accent">+</span></>}
            label="Brands Listed"
          />
          <BigStatCard
            accent="#3FA68A"
            display={<><CountUp to={cityCount} format="comma" /><span className="text-brand-accent">+</span></>}
            label="Cities Covered"
          />
        </div>
      </div>
    </div>
  )
}

// No box-shadow, in either the resting or the hover state (client request
// 2026-09-03). The card is defined by its border and its mint top rule alone.
function BigStatCard({
  accent, display, label, live,
}: { accent: string; display: React.ReactNode; label: string; live?: boolean }) {
  return (
    <div className="relative overflow-hidden bg-surface rounded-2xl border border-border p-3 md:p-4 transition-all duration-300 hover:-translate-y-1 cursor-default">
      <span className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: accent }} aria-hidden />
      {/* The LIVE badge is hidden below md: at a third of a 390px viewport it
          sits on top of the number. Desktop keeps it. */}
      {live && (
        <span className="hidden md:inline-flex absolute top-4 right-4 items-center gap-2 text-caption font-semibold tracking-wider uppercase text-brand-accent">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent" />
          </span>
          LIVE
        </span>
      )}
      {/* The oversized ghost number that used to sit bottom-right was removed
          2026-09-03 (client request). It read as a shadow behind the real
          figure and was the main thing keeping the card tall. */}
      <div className="relative">
        <div className="font-serif text-[19px] md:text-[32px] leading-[1.05] md:leading-[0.95] font-medium text-ink-primary mb-1">{display}</div>
        <div className="text-caption md:text-body font-semibold text-ink-primary">{label}</div>
      </div>
    </div>
  )
}
