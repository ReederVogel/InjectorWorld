'use client'

// Tiny hand-rolled SVG chart primitives. No chart library dependency.

const MINT = '#3FA68A'
const NAVY = '#0B1B34'
const GOLD = '#C2A14E'

function buildPath(values: number[], width: number, height: number, pad: number): string {
  if (values.length === 0) return ''
  const max = Math.max(...values, 1)
  const stepX = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0
  return values
    .map((v, i) => {
      const x = pad + i * stepX
      const y = height - pad - (v / max) * (height - pad * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/** Small inline sparkline, no axes. Used in the clinic edit panel and KPI chips. */
export function Sparkline({
  values,
  width = 160,
  height = 40,
  color = MINT,
}: {
  values: number[]
  width?: number
  height?: number
  color?: string
}) {
  if (values.length === 0 || values.every((v) => v === 0)) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <line x1={4} y1={height - 4} x2={width - 4} y2={height - 4} stroke="var(--theme-elevation-150, #e2e8f0)" strokeWidth={1} />
      </svg>
    )
  }
  const pad = 4
  const d = buildPath(values, width, height, pad)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export type SeriesPoint = { label: string; a: number; b?: number }

/** Two-line area/line chart (e.g. pageviews + visitors) with a hairline axis. */
export function DualLineChart({
  data,
  height = 220,
  aLabel = 'Series A',
  bLabel = 'Series B',
  aColor = NAVY,
  bColor = MINT,
}: {
  data: SeriesPoint[]
  height?: number
  aLabel?: string
  bLabel?: string
  aColor?: string
  bColor?: string
}) {
  const width = 640
  const pad = 28
  const aValues = data.map((d) => d.a)
  const bValues = data.map((d) => d.b ?? 0)
  const max = Math.max(...aValues, ...bValues, 1)

  const toPoints = (values: number[]) =>
    values.map((v, i) => {
      const stepX = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0
      const x = pad + i * stepX
      const y = height - pad - (v / max) * (height - pad * 2)
      return [x, y] as const
    })

  const aPts = toPoints(aValues)
  const bPts = toPoints(bValues)
  const toPath = (pts: readonly (readonly [number, number])[]) =>
    pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const toArea = (pts: readonly (readonly [number, number])[]) =>
    `${toPath(pts)} L${pts[pts.length - 1][0].toFixed(1)},${height - pad} L${pts[0][0].toFixed(1)},${height - pad} Z`

  // Show at most ~7 x-axis labels so dense ranges (90 days) don't overlap.
  const labelEvery = Math.max(1, Math.ceil(data.length / 7))

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${width} ${height + 20}`} style={{ display: 'block' }}>
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--theme-elevation-150, #e2e8f0)" strokeWidth={1} />
        <path d={toArea(aPts)} fill={aColor} opacity={0.08} stroke="none" />
        <path d={toPath(aPts)} fill="none" stroke={aColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={toPath(bPts)} fill="none" stroke={bColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text
              key={d.label}
              x={aPts[i][0]}
              y={height}
              fontSize={9}
              textAnchor="middle"
              fill="var(--theme-text, #475569)"
              opacity={0.6}
            >
              {d.label}
            </text>
          ) : null,
        )}
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 12 }}>
        <LegendDot color={aColor} label={aLabel} />
        <LegendDot color={bColor} label={bLabel} />
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.75 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

export type BarRow = { label: string; value: number; href?: string; sub?: string }

/** Horizontal bar list, bars scaled to the max value in the set. */
export function BarList({
  rows,
  color = MINT,
  formatValue,
}: {
  rows: BarRow[]
  color?: string
  formatValue?: (n: number) => string
}) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  const fmt = formatValue ?? ((n: number) => n.toLocaleString())
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => {
        const pct = Math.max(2, (r.value / max) * 100)
        const content = (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                {r.label}
                {r.sub && <span style={{ opacity: 0.5 }}> · {r.sub}</span>}
              </span>
              <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{fmt(r.value)}</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'var(--theme-elevation-100, #f1f5f9)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: color }} />
            </div>
          </>
        )
        return r.href ? (
          <a key={r.label} href={r.href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
            {content}
          </a>
        ) : (
          <div key={r.label}>{content}</div>
        )
      })}
    </div>
  )
}

export { MINT, NAVY, GOLD }
