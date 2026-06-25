// Neighborhoods are not routable pages. They surface as a filter on the city
// pages, derived directly from the clinic/provider data so any newly imported
// or manually added neighborhood shows up automatically (no admin linking step).

/** Distinct, display-cased, alphabetically sorted neighborhood names. */
export function distinctNeighborhoods(values: Array<string | undefined | null>): string[] {
  const byKey = new Map<string, string>() // lowercase key -> first-seen display value
  for (const v of values) {
    const t = (v ?? '').trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (!byKey.has(key)) byKey.set(key, t)
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b))
}

/** True when the item's neighborhood matches the selected one (or none selected). */
export function matchesNeighborhood(
  itemNeighborhood: string | undefined | null,
  selected: string,
): boolean {
  if (!selected) return true
  return (itemNeighborhood ?? '').trim().toLowerCase() === selected.toLowerCase()
}
