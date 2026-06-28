'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

export type StateData = {
  name: string
  slug: string
  abbr: string
  isLive: boolean
  clinicCount: number
}

// SVG viewBox paths for all 50 US states (AlbersUSA projection, 960x600)
const STATE_PATHS: Record<string, string> = {
  AL: 'M 586.5 353.8 L 590.4 353.8 L 592.9 375.9 L 594.2 386.4 L 587.2 387.0 L 578.1 387.6 L 577.3 380.3 L 575.8 371.3 L 575.7 362.6 Z',
  AK: 'M 156.0 439.0 L 175.0 439.0 L 175.0 470.0 L 156.0 470.0 Z M 200.0 460.0 L 215.0 460.0 L 215.0 475.0 L 200.0 475.0 Z',
  AZ: 'M 197.0 304.8 L 218.3 309.0 L 241.8 314.0 L 243.5 295.6 L 246.1 271.8 L 246.4 264.0 L 220.7 264.0 L 202.0 264.0 L 197.0 280.0 Z',
  AR: 'M 544.0 316.0 L 547.0 335.0 L 549.0 352.0 L 526.0 353.0 L 507.0 353.0 L 507.0 335.0 L 507.5 316.5 L 522.0 316.0 Z',
  CA: 'M 118.0 230.0 L 128.0 208.0 L 145.0 178.0 L 158.0 160.0 L 171.0 148.0 L 176.0 138.0 L 190.0 158.0 L 197.0 185.0 L 197.0 210.0 L 197.0 264.0 L 175.0 264.0 L 155.0 275.0 L 135.0 290.0 L 118.0 280.0 Z',
  CO: 'M 280.0 230.0 L 340.0 228.0 L 342.0 268.0 L 281.0 270.0 Z',
  CT: 'M 732.0 168.0 L 742.0 165.0 L 748.0 180.0 L 735.0 185.0 Z',
  DE: 'M 718.0 193.0 L 726.0 188.0 L 730.0 202.0 L 722.0 208.0 Z',
  FL: 'M 595.0 388.0 L 614.0 387.0 L 635.0 390.0 L 650.0 400.0 L 655.0 420.0 L 645.0 440.0 L 625.0 450.0 L 610.0 440.0 L 598.0 425.0 L 593.0 408.0 Z',
  GA: 'M 622.0 320.0 L 638.0 316.0 L 648.0 330.0 L 644.0 360.0 L 638.0 388.0 L 614.0 387.0 L 595.0 388.0 L 590.0 353.0 L 592.0 330.0 L 608.0 322.0 Z',
  HI: 'M 300.0 460.0 L 315.0 460.0 L 315.0 474.0 L 300.0 474.0 Z M 326.0 460.0 L 338.0 460.0 L 338.0 472.0 L 326.0 472.0 Z',
  ID: 'M 196.0 130.0 L 218.0 128.0 L 230.0 148.0 L 228.0 175.0 L 218.0 195.0 L 205.0 207.0 L 198.0 200.0 L 190.0 185.0 L 190.0 158.0 Z',
  IL: 'M 548.0 222.0 L 560.0 220.0 L 570.0 235.0 L 570.0 270.0 L 562.0 300.0 L 548.0 310.0 L 537.0 300.0 L 535.0 268.0 L 538.0 240.0 Z',
  IN: 'M 578.0 220.0 L 590.0 220.0 L 596.0 245.0 L 592.0 278.0 L 580.0 278.0 L 570.0 270.0 L 570.0 235.0 Z',
  IA: 'M 490.0 208.0 L 535.0 202.0 L 548.0 210.0 L 548.0 222.0 L 538.0 240.0 L 490.0 240.0 L 474.0 232.0 Z',
  KS: 'M 390.0 272.0 L 450.0 270.0 L 490.0 268.0 L 490.0 300.0 L 390.0 302.0 Z',
  KY: 'M 596.0 278.0 L 616.0 272.0 L 640.0 272.0 L 648.0 285.0 L 632.0 300.0 L 600.0 305.0 L 580.0 300.0 L 570.0 285.0 L 580.0 278.0 Z',
  LA: 'M 508.0 380.0 L 535.0 375.0 L 556.0 376.0 L 565.0 390.0 L 555.0 405.0 L 530.0 408.0 L 510.0 400.0 Z',
  ME: 'M 760.0 118.0 L 778.0 110.0 L 790.0 128.0 L 780.0 145.0 L 762.0 148.0 Z',
  MD: 'M 700.0 218.0 L 720.0 212.0 L 732.0 222.0 L 726.0 235.0 L 700.0 232.0 Z',
  MA: 'M 748.0 158.0 L 768.0 153.0 L 778.0 162.0 L 768.0 170.0 L 748.0 168.0 Z',
  MI: 'M 578.0 178.0 L 600.0 165.0 L 615.0 178.0 L 615.0 195.0 L 600.0 200.0 L 578.0 195.0 Z M 555.0 198.0 L 570.0 195.0 L 578.0 210.0 L 560.0 220.0 L 548.0 210.0 Z',
  MN: 'M 455.0 132.0 L 490.0 128.0 L 498.0 148.0 L 498.0 175.0 L 490.0 208.0 L 455.0 208.0 L 435.0 195.0 L 430.0 165.0 L 440.0 145.0 Z',
  MS: 'M 549.0 352.0 L 560.0 352.0 L 575.0 352.0 L 577.0 380.0 L 578.0 388.0 L 565.0 390.0 L 556.0 376.0 L 535.0 375.0 L 535.0 355.0 L 547.0 355.0 Z',
  MO: 'M 490.0 268.0 L 505.0 262.0 L 535.0 268.0 L 548.0 278.0 L 545.0 310.0 L 525.0 318.0 L 506.0 318.0 L 490.0 302.0 Z',
  MT: 'M 202.0 118.0 L 280.0 110.0 L 325.0 110.0 L 328.0 148.0 L 295.0 160.0 L 255.0 165.0 L 218.0 165.0 L 202.0 148.0 Z',
  NE: 'M 390.0 238.0 L 450.0 232.0 L 490.0 232.0 L 490.0 268.0 L 450.0 270.0 L 390.0 272.0 L 365.0 262.0 Z',
  NV: 'M 155.0 200.0 L 198.0 200.0 L 205.0 225.0 L 205.0 265.0 L 185.0 275.0 L 158.0 265.0 L 148.0 248.0 L 145.0 222.0 Z',
  NH: 'M 748.0 130.0 L 758.0 125.0 L 765.0 145.0 L 760.0 165.0 L 748.0 158.0 Z',
  NJ: 'M 718.0 193.0 L 728.0 188.0 L 738.0 195.0 L 735.0 215.0 L 720.0 218.0 Z',
  NM: 'M 248.0 320.0 L 280.0 318.0 L 318.0 318.0 L 318.0 358.0 L 280.0 360.0 L 248.0 360.0 L 243.0 338.0 Z',
  NY: 'M 692.0 155.0 L 720.0 145.0 L 748.0 148.0 L 748.0 168.0 L 735.0 185.0 L 715.0 195.0 L 700.0 185.0 L 690.0 172.0 Z',
  NC: 'M 648.0 285.0 L 680.0 278.0 L 710.0 272.0 L 720.0 285.0 L 700.0 300.0 L 668.0 305.0 L 640.0 305.0 L 632.0 300.0 Z',
  ND: 'M 340.0 130.0 L 415.0 128.0 L 438.0 132.0 L 435.0 165.0 L 390.0 168.0 L 340.0 170.0 Z',
  OH: 'M 620.0 220.0 L 640.0 218.0 L 652.0 235.0 L 648.0 272.0 L 616.0 272.0 L 596.0 262.0 L 596.0 245.0 Z',
  OK: 'M 390.0 302.0 L 490.0 300.0 L 507.0 300.0 L 507.0 318.0 L 490.0 318.0 L 390.0 320.0 L 320.0 318.0 L 320.0 302.0 Z',
  OR: 'M 138.0 148.0 L 160.0 145.0 L 196.0 140.0 L 196.0 165.0 L 190.0 185.0 L 175.0 185.0 L 148.0 178.0 L 128.0 170.0 L 125.0 155.0 Z',
  PA: 'M 668.0 188.0 L 700.0 185.0 L 715.0 195.0 L 714.0 218.0 L 700.0 218.0 L 668.0 215.0 L 655.0 205.0 Z',
  RI: 'M 748.0 168.0 L 755.0 165.0 L 758.0 176.0 L 750.0 180.0 Z',
  SC: 'M 648.0 315.0 L 668.0 305.0 L 690.0 308.0 L 695.0 328.0 L 672.0 345.0 L 648.0 345.0 L 640.0 330.0 Z',
  SD: 'M 340.0 170.0 L 390.0 168.0 L 435.0 165.0 L 438.0 200.0 L 415.0 208.0 L 390.0 210.0 L 340.0 212.0 L 328.0 200.0 Z',
  TN: 'M 570.0 305.0 L 600.0 305.0 L 632.0 300.0 L 648.0 305.0 L 640.0 318.0 L 610.0 320.0 L 580.0 322.0 L 548.0 320.0 L 544.0 310.0 L 548.0 305.0 Z',
  TX: 'M 318.0 318.0 L 390.0 320.0 L 490.0 318.0 L 507.0 318.0 L 507.0 355.0 L 507.0 380.0 L 508.0 400.0 L 490.0 415.0 L 465.0 430.0 L 440.0 420.0 L 415.0 400.0 L 395.0 380.0 L 375.0 375.0 L 355.0 368.0 L 330.0 370.0 L 315.0 360.0 L 318.0 340.0 Z',
  UT: 'M 202.0 228.0 L 246.0 232.0 L 246.0 270.0 L 246.0 296.0 L 200.0 295.0 L 197.0 265.0 L 197.0 245.0 Z',
  VT: 'M 738.0 130.0 L 748.0 125.0 L 748.0 148.0 L 738.0 148.0 L 730.0 138.0 Z',
  VA: 'M 648.0 252.0 L 680.0 245.0 L 715.0 240.0 L 718.0 255.0 L 700.0 268.0 L 680.0 278.0 L 648.0 285.0 L 638.0 270.0 Z',
  WA: 'M 138.0 100.0 L 170.0 95.0 L 200.0 100.0 L 200.0 120.0 L 170.0 125.0 L 148.0 130.0 L 130.0 125.0 Z',
  WV: 'M 648.0 235.0 L 664.0 228.0 L 680.0 228.0 L 685.0 245.0 L 680.0 258.0 L 660.0 262.0 L 648.0 252.0 Z',
  WI: 'M 530.0 165.0 L 555.0 158.0 L 575.0 165.0 L 578.0 185.0 L 570.0 200.0 L 548.0 208.0 L 530.0 200.0 L 520.0 185.0 Z',
  WY: 'M 280.0 175.0 L 340.0 172.0 L 342.0 228.0 L 280.0 230.0 Z',
}

// State label positions (cx, cy) for abbreviation text
const STATE_LABELS: Record<string, [number, number]> = {
  AL: [586, 365], AK: [165, 455], AZ: [222, 290], AR: [528, 335],
  CA: [155, 225], CO: [311, 250], CT: [738, 175], DE: [723, 200],
  FL: [625, 415], GA: [622, 350], HI: [325, 467], ID: [210, 168],
  IL: [553, 262], IN: [582, 252], IA: [510, 222], KS: [440, 287],
  KY: [608, 288], LA: [532, 392], ME: [775, 130], MD: [712, 225],
  MA: [762, 162], MI: [588, 187], MN: [465, 170], MS: [560, 372],
  MO: [515, 290], MT: [262, 135], NE: [432, 252], NV: [175, 238],
  NH: [756, 143], NJ: [728, 205], NM: [280, 340], NY: [718, 168],
  NC: [678, 292], ND: [388, 150], OH: [624, 248], OK: [435, 310],
  OR: [160, 165], PA: [685, 203], RI: [752, 172], SC: [668, 328],
  SD: [385, 188], TN: [592, 312], TX: [415, 365], UT: [222, 262],
  VT: [740, 138], VA: [678, 262], WA: [165, 112], WV: [664, 248],
  WI: [548, 185], WY: [310, 202],
}

export function USMapClient({ states }: { states: StateData[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [hovered, setHovered] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; state: StateData } | null>(null)

  const stateMap = useMemo(() => {
    const m = new Map<string, StateData>()
    for (const s of states) if (s.abbr) m.set(s.abbr.toUpperCase(), s)
    return m
  }, [states])

  const filtered = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    return new Set(
      states
        .filter((s) => s.name.toLowerCase().includes(q) || s.abbr.toLowerCase().includes(q))
        .map((s) => s.abbr.toUpperCase()),
    )
  }, [search, states])

  const handleClick = (abbr: string) => {
    const s = stateMap.get(abbr)
    if (!s) return
    router.push(`/${s.slug}`)
  }

  const handleMouseEnter = (abbr: string, e: React.MouseEvent<SVGPathElement>) => {
    const s = stateMap.get(abbr)
    if (!s) return
    setHovered(abbr)
    const rect = (e.currentTarget.closest('svg') as SVGSVGElement).getBoundingClientRect()
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 40, state: s })
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!hovered) return
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip((prev) => prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top - 44 } : null)
  }

  const handleMouseLeave = () => {
    setHovered(null)
    setTooltip(null)
  }

  const getStateFill = (abbr: string) => {
    const s = stateMap.get(abbr)
    const isHighlighted = filtered ? filtered.has(abbr) : true
    const isDimmed = filtered ? !filtered.has(abbr) : false
    if (isDimmed) return '#EEF1F5'
    if (abbr === hovered) return s?.isLive ? '#2d9175' : '#94A3B8'
    if (s?.isLive) return '#3FA68A'
    return '#CBD5E1'
  }

  const allAbbrs = Object.keys(STATE_PATHS)

  return (
    <div className="space-y-6">
      {/* Search box */}
      <div className="relative max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search a state..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface pl-9 pr-4 py-2.5 text-body-sm text-ink-primary placeholder:text-ink-tertiary focus:border-brand-accent focus:outline-none transition"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-caption text-ink-secondary">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-brand-accent" />
          Live now
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-[#CBD5E1]" />
          Coming soon
        </span>
      </div>

      {/* Map */}
      <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-surface-warm">
        <svg
          viewBox="100 90 870 490"
          className="w-full h-auto cursor-default select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {allAbbrs.map((abbr) => (
            <g key={abbr}>
              <path
                d={STATE_PATHS[abbr]}
                fill={getStateFill(abbr)}
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
                className={stateMap.has(abbr) ? 'cursor-pointer transition-colors duration-150' : ''}
                onClick={() => handleClick(abbr)}
                onMouseEnter={(e) => handleMouseEnter(abbr, e)}
              />
              {STATE_LABELS[abbr] && (
                <text
                  x={STATE_LABELS[abbr][0]}
                  y={STATE_LABELS[abbr][1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="9"
                  fontWeight="600"
                  fill={stateMap.get(abbr)?.isLive && getStateFill(abbr) !== '#EEF1F5' ? 'white' : '#475569'}
                  pointerEvents="none"
                >
                  {abbr}
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 rounded-xl border border-border bg-surface px-3 py-2 shadow-md text-body-sm"
            style={{ left: tooltip.x, top: tooltip.y, transform: 'translateX(-50%)' }}
          >
            <p className="font-semibold text-ink-primary">{tooltip.state.name}</p>
            {tooltip.state.isLive ? (
              <p className="text-brand-accent text-caption mt-0.5">
                {tooltip.state.clinicCount > 0 ? `${tooltip.state.clinicCount.toLocaleString()} clinics` : 'Live'}
              </p>
            ) : (
              <p className="text-ink-tertiary text-caption mt-0.5">Coming soon</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
