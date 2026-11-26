import type { ClinicAnalytics } from '@/lib/clinic-analytics'

const fmt = (n: number) => n.toLocaleString('en-US')
const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface/80 p-4">
      <p className="mb-0.5 text-caption font-medium uppercase tracking-wider text-ink-tertiary">{label}</p>
      <p className="font-serif text-[1.75rem] font-medium leading-tight text-ink-primary">{fmt(value)}</p>
      {sub && <p className="mt-0.5 text-caption text-ink-tertiary">{sub}</p>}
    </div>
  )
}

/**
 * The owner's numbers inside the plan box: totals for Pro (30 days), plus a
 * views-per-day chart and visitor sources for Elite (90 days). Server-rendered.
 */
export function ClinicAnalyticsPanel({ data }: { data: ClinicAnalytics | null }) {
  if (!data) return <p className="text-body-sm text-ink-secondary">Your numbers are not available right now. Please check back later.</p>

  const clicks = data.clicks.call + data.clicks.website + data.clicks.directions
  const max = Math.max(0, ...(data.series ?? []).map((d) => d.views))
  const totalSessions = (data.sources ?? []).reduce((n, s) => n + s.sessions, 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Page views" value={data.views} sub={`${fmt(data.visitors)} ${data.visitors === 1 ? 'person' : 'people'}`} />
        <Tile label="Requests" value={data.leads} sub="Consultation forms" />
        <Tile label="Clicks" value={clicks} sub={`${fmt(data.clicks.call)} call · ${fmt(data.clicks.website)} web · ${fmt(data.clicks.directions)} map`} />
        <Tile label="Shares" value={data.shares} sub="Page link shared" />
      </div>

      {data.series && (
        <div>
          <p className="mb-2 text-caption font-medium uppercase tracking-wider text-ink-tertiary">Page views per day</p>
          <div className="flex h-24 items-end gap-px" role="img" aria-label={`Page views per day for the last ${data.days} days. Busiest day: ${fmt(max)} views.`}>
            {data.series.map((d) => (
              <div
                key={d.day}
                title={`${shortDay(d.day)}: ${fmt(d.views)} view${d.views === 1 ? '' : 's'}`}
                className={`flex-1 ${d.views ? 'bg-brand-primary' : 'bg-border'}`}
                style={{ height: `${max && d.views ? Math.max(4, (d.views / max) * 100) : 2}%` }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-caption text-ink-tertiary">
            <span>{shortDay(data.series[0].day)}</span>
            <span>Today</span>
          </div>
        </div>
      )}

      {data.sources && totalSessions > 0 && (
        <div>
          <p className="mb-2 text-caption font-medium uppercase tracking-wider text-ink-tertiary">Where your visitors came from</p>
          <ul className="space-y-2">
            {data.sources.map((s) => (
              <li key={s.label}>
                <div className="flex justify-between gap-3 text-body-sm">
                  <span className="truncate text-ink-primary">{s.label}</span>
                  <span className="shrink-0 text-ink-secondary">{Math.round((s.sessions / totalSessions) * 100)}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-border">
                  <div className="h-full rounded-full bg-brand-primary" style={{ width: `${(s.sessions / totalSessions) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-caption text-ink-tertiary">Last {data.days} days. Known bots are not counted.</p>
    </div>
  )
}
