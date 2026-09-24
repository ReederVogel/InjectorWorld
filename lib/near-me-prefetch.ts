/**
 * Page-1 near-me listing started early by NearMeBoot (2026-09-24,
 * docs/PAGE-SPEED-PLAN-2026-09-24.md, round C).
 *
 * The three pillar listings (/brands/<brand>, /services/<service>, /clinics)
 * hide their list until the visitor is located, then fetch page 1 for that
 * place. That fetch used to wait for React to hydrate. NearMeBoot now starts it
 * during HTML parse, as soon as the geo answer (or a saved ZIP) is known, and
 * parks it on `window.__iwNearMeList`.
 *
 * This file only decides whether that parked request IS the one a listing is
 * about to make. It changes nothing about which URL a listing asks for: the
 * listing still builds its URL exactly as before (ZIP centre, 4-decimal
 * coordinates, the radius ladder, filters), and the parked answer is used only
 * when the two URLs carry identical parameters. Anything else (a filter, a
 * widened radius, a different point after the geo timeout) falls through to a
 * normal fetch, so a wrong list can never be shown.
 */

type Parked = { url: string; p: Promise<unknown> }

/** Path plus parameters in sorted order, so parameter order cannot cause a miss. */
function canonical(url: string): string {
  const u = new URL(url, 'http://local')
  const entries = [...u.searchParams.entries()].sort(([a, av], [b, bv]) =>
    a === b ? av.localeCompare(bv) : a.localeCompare(b),
  )
  return `${u.pathname}?${entries.map(([k, v]) => `${k}=${v}`).join('&')}`
}

/** The parked page-1 response for exactly this URL, taken once; otherwise null. */
function takeParked(url: string): Promise<unknown> | null {
  try {
    const w = window as unknown as { __iwNearMeList?: Parked }
    const parked = w.__iwNearMeList
    if (!parked) return null
    // Taken whether or not it matches: once the listing has asked for anything,
    // the parked answer can only be stale.
    delete w.__iwNearMeList
    return canonical(parked.url) === canonical(url) ? parked.p : null
  } catch {
    return null
  }
}

/**
 * GET a listing API URL and return its JSON. Uses the parked early request when
 * it is for this exact URL and succeeded; otherwise fetches normally. Throws on
 * a non-OK response, like the inline fetches it replaces.
 */
export async function fetchListingJson(url: string): Promise<any> {
  const parked = takeParked(url)
  if (parked) {
    const data = await parked
    if (data) return data
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error('Unable to load clinics.')
  return res.json()
}
