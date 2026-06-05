type Props = {
  painIndex?: number | null
  longevityLabel?: string | null
  downtimeLabel?: string | null
  className?: string
}

function PainDots({ level }: { level: number }) {
  return (
    <span className="flex gap-0.5 items-center" aria-label={`Pain level ${level} out of 10`}>
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            i < level ? 'bg-state-error' : 'bg-border'
          }`}
        />
      ))}
    </span>
  )
}

export function TreatmentIndices({ painIndex, longevityLabel, downtimeLabel, className = '' }: Props) {
  if (!painIndex && !longevityLabel && !downtimeLabel) return null

  return (
    <div className={`flex flex-wrap gap-3 ${className}`} aria-label="Treatment at a glance">
      {longevityLabel && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-tertiary leading-none mb-0.5">Lasts</div>
            <div className="text-body-sm font-medium text-ink-primary leading-none">{longevityLabel}</div>
          </div>
        </div>
      )}
      {downtimeLabel && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-tertiary leading-none mb-0.5">Downtime</div>
            <div className="text-body-sm font-medium text-ink-primary leading-none">{downtimeLabel}</div>
          </div>
        </div>
      )}
      {painIndex != null && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-tertiary leading-none mb-1">Pain level</div>
            <PainDots level={painIndex} />
          </div>
        </div>
      )}
    </div>
  )
}
