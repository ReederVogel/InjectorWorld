/**
 * Derives the Location slug from a clinic/provider's city + state strings.
 * Matches the seed pattern: "New York City","NY" → "new-york-ny"
 * Edge case: "Washington DC","DC" → "washington-dc" (not "washington-dc-dc")
 */
export function toCitySlug(city: string, state: string): string {
  const cityPart = city
    .toLowerCase()
    .replace(/\s+city$/i, '')     // "New York City" → "New York"
    .replace(/[^a-z0-9\s]/g, '') // strip non-alphanumeric
    .trim()
    .replace(/\s+/g, '-')

  const statePart = state.toLowerCase()

  // Avoid doubling state: "washington-dc" + "dc" → "washington-dc"
  if (cityPart.endsWith(`-${statePart}`)) return cityPart

  return `${cityPart}-${statePart}`
}
