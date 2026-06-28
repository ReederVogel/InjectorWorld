import { cache } from 'react'
import { getPayloadInstance } from './payload-server'

export type HeaderNavItem = { label: string; href: string }

export type HeaderNavData = {
  services: HeaderNavItem[]
  locations: HeaderNavItem[]
  guides: HeaderNavItem[]
  brands: HeaderNavItem[]
}

// ─── Fallback defaults (used until admin configures Header Editor) ─────────────

const FALLBACK_SERVICES: HeaderNavItem[] = [
  { label: 'Lip Filler', href: '/services/lip-filler' },
  { label: 'Cheek Filler', href: '/services/cheek-filler' },
  { label: 'Jawline Filler', href: '/services/jawline-filler' },
  { label: 'Tear Trough Filler', href: '/services/tear-trough' },
  { label: 'Masseter Botox', href: '/services/masseter-botox' },
  { label: 'Forehead Botox', href: '/services/forehead-botox' },
  { label: 'Thread Lift', href: '/services/thread-lift' },
  { label: 'Microneedling', href: '/services/microneedling' },
  { label: 'PRP', href: '/services/prp' },
  { label: 'Brow Lift', href: '/services/brow-lift' },
]

const FALLBACK_LOCATIONS: HeaderNavItem[] = [
  { label: 'New York City', href: '/services/botox/new-york/new-york-city' },
  { label: 'Los Angeles', href: '/services/botox/california/los-angeles' },
  { label: 'Miami', href: '/services/botox/florida/miami' },
  { label: 'Houston', href: '/services/botox/texas/houston' },
  { label: 'Chicago', href: '/services/botox/illinois/chicago' },
  { label: 'Dallas', href: '/services/botox/texas/dallas' },
  { label: 'Austin', href: '/services/botox/texas/austin' },
  { label: 'San Francisco', href: '/services/botox/california/san-francisco' },
  { label: 'Atlanta', href: '/services/botox/georgia/atlanta' },
  { label: 'Seattle', href: '/services/botox/washington/seattle' },
  { label: 'California', href: '/services/botox/california' },
  { label: 'New York', href: '/services/botox/new-york' },
  { label: 'Florida', href: '/services/botox/florida' },
  { label: 'Texas', href: '/services/botox/texas' },
  { label: 'Illinois', href: '/services/botox/illinois' },
  { label: 'Colorado', href: '/services/botox/colorado' },
  { label: 'Georgia', href: '/services/botox/georgia' },
  { label: 'Arizona', href: '/services/botox/arizona' },
  { label: 'Washington', href: '/services/botox/washington' },
  { label: 'Massachusetts', href: '/services/botox/massachusetts' },
]

const FALLBACK_BRANDS: HeaderNavItem[] = [
  { label: 'Botox', href: '/brands/botox' },
  { label: 'Dysport', href: '/brands/dysport' },
  { label: 'Xeomin', href: '/brands/xeomin' },
  { label: 'Daxxify', href: '/brands/daxxify' },
  { label: 'Juvederm', href: '/brands/juvederm' },
  { label: 'Restylane', href: '/brands/restylane' },
  { label: 'Sculptra', href: '/brands/sculptra' },
  { label: 'Radiesse', href: '/brands/radiesse' },
  { label: 'Kybella', href: '/brands/kybella' },
]

const FALLBACK_GUIDES: HeaderNavItem[] = [
  { label: 'Botox Guide', href: '/guides/botox' },
  { label: 'Lip Filler', href: '/guides/lip-filler' },
  { label: 'First-time Botox', href: '/guides/first-time-botox' },
  { label: 'What Botox Costs in 2026', href: '/guides/botox-cost-2026' },
  { label: 'Is Botox Safe?', href: '/guides/is-botox-safe' },
  { label: 'MD vs NP vs RN', href: '/guides/md-vs-np-vs-rn' },
  { label: 'Masseter Botox', href: '/guides/masseter-botox' },
  { label: 'How to Choose an Injector', href: '/guides/how-to-choose-injector' },
  { label: 'Red Flags Before Booking', href: '/guides/red-flags' },
  { label: 'Botox vs Filler', href: '/guides/botox-vs-filler' },
]

// ─── State code → slug map ────────────────────────────────────────────────────

async function getStateCodeToSlug(payload: any): Promise<Map<string, string>> {
  try {
    const res = await payload.find({
      collection: 'locations',
      where: { kind: { equals: 'state' } },
      limit: 60,
      depth: 0,
    })
    const map = new Map<string, string>()
    for (const s of res.docs as any[]) {
      if (s.state) map.set(String(s.state).toUpperCase(), s.slug as string)
    }
    return map
  } catch {
    return new Map()
  }
}

// ─── Main query ───────────────────────────────────────────────────────────────

export const getHeaderNavData = cache(async function getHeaderNavData(): Promise<HeaderNavData> {
  try {
    const payload = await getPayloadInstance()
    const [config, stateCodeToSlug]: [any, Map<string, string>] = await Promise.all([
      payload.findGlobal({ slug: 'header-config', depth: 1 }).catch(() => null as any),
      getStateCodeToSlug(payload),
    ])

    if (!config) return { services: FALLBACK_SERVICES, locations: FALLBACK_LOCATIONS, guides: FALLBACK_GUIDES, brands: FALLBACK_BRANDS }

    // ── Services ────────────────────────────────────────────────────────────
    const services: HeaderNavItem[] =
      Array.isArray((config as any).featuredServices) && (config as any).featuredServices.length > 0
        ? (config as any).featuredServices
            .filter((s: any) => s && typeof s === 'object' && s.name && s.slug)
            .map((s: any) => ({ label: s.name as string, href: `/services/${s.slug}` }))
        : FALLBACK_SERVICES

    // ── Locations ───────────────────────────────────────────────────────────
    const locations: HeaderNavItem[] =
      Array.isArray((config as any).featuredLocations) && (config as any).featuredLocations.length > 0
        ? (config as any).featuredLocations
            .filter((l: any) => l && typeof l === 'object' && l.name && l.slug)
            .map((l: any) => {
              const isState = l.kind === 'state'
              if (isState) return { label: l.name as string, href: `/services/botox/${l.slug}` }
              const stateSlug = stateCodeToSlug.get(String(l.state ?? '').toUpperCase()) ?? String(l.state ?? '').toLowerCase()
              return { label: l.name as string, href: `/services/botox/${stateSlug}/${l.slug}` }
            })
        : FALLBACK_LOCATIONS

    // ── Guides ──────────────────────────────────────────────────────────────
    const guides: HeaderNavItem[] =
      Array.isArray((config as any).featuredGuides) && (config as any).featuredGuides.length > 0
        ? (config as any).featuredGuides
            .filter((g: any) => g && typeof g === 'object' && g.title && g.slug)
            .map((g: any) => ({ label: g.title as string, href: `/guides/${g.slug}` }))
        : FALLBACK_GUIDES

    // ── Brands ──────────────────────────────────────────────────────────────
    const brands: HeaderNavItem[] =
      Array.isArray((config as any).featuredBrands) && (config as any).featuredBrands.length > 0
        ? (config as any).featuredBrands
            .filter((b: any) => b && typeof b === 'object' && b.name && b.slug)
            .map((b: any) => ({ label: b.name as string, href: `/brands/${b.slug}` }))
        : FALLBACK_BRANDS

    return { services, locations, guides, brands }
  } catch {
    return { services: FALLBACK_SERVICES, locations: FALLBACK_LOCATIONS, guides: FALLBACK_GUIDES, brands: FALLBACK_BRANDS }
  }
})
