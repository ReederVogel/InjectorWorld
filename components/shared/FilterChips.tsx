'use client'

export type FilterChip = { value: string; label: string; count: number }

/**
 * One row of "Label (count)" toggle chips over a listing grid. Used by the
 * /guides category filter and the /news month filter. Wraps on desktop,
 * scrolls sideways on phones so the grid is not pushed below the fold.
 */
export function FilterChips({
  chips,
  active,
  onChange,
  label,
}: {
  chips: FilterChip[]
  active: string
  onChange: (value: string) => void
  /** Accessible name for the group, e.g. "Filter guides by category". */
  label: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-5 mb-8 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
    >
      {chips.map((chip) => {
        const on = chip.value === active
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(chip.value)}
            className={`inline-flex min-h-11 flex-shrink-0 items-center whitespace-nowrap rounded-control border px-4 text-body-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
              on
                ? 'border-brand-primary bg-brand-primary text-surface-canvas'
                : 'border-border bg-surface-canvas text-ink-secondary hover:border-ink-tertiary hover:text-ink-primary'
            }`}
          >
            {chip.label} ({chip.count})
          </button>
        )
      })}
    </div>
  )
}
