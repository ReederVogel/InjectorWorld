/**
 * Bulk-generates fake clinics (no images) for load-testing directory/listing
 * pages on a non-production database (staging, dev). Spread across the 20
 * locked phase-1 metros with real coordinates so map/PostGIS behavior is
 * realistic. Every clinic is tagged clinicId "dummy-NNNNN" so re-runs are
 * idempotent (top up to --count, never duplicate) and everything is easy to
 * find/delete later with a single query.
 *
 * Requires `npm run seed` to have already run (services + brands + locations
 * must exist — this script only adds clinics on top of that baseline).
 *
 * Usage:
 *   npm run seed:dummy-clinics                # 3000 clinics (default)
 *   npm run seed:dummy-clinics -- --count=500  # custom count
 */
import { getPayload } from 'payload'
import config from '../payload.config'

type Metro = { name: string; state: string; lat: number; lng: number; zip: string }

// Same 20 metros + coordinates as scripts/seed-data.ts, plus a plausible
// downtown ZIP per metro (not validated against the zip-codes table — this
// is throwaway test data, not real business records).
const metros: Metro[] = [
  { name: 'New York City', state: 'NY', lat: 40.7128, lng: -74.0060, zip: '10001' },
  { name: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437, zip: '90012' },
  { name: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918, zip: '33130' },
  { name: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298, zip: '60601' },
  { name: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698, zip: '77002' },
  { name: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970, zip: '75201' },
  { name: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880, zip: '30303' },
  { name: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740, zip: '85003' },
  { name: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321, zip: '98101' },
  { name: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589, zip: '02108' },
  { name: 'Washington DC', state: 'DC', lat: 38.9072, lng: -77.0369, zip: '20001' },
  { name: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194, zip: '94102' },
  { name: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903, zip: '80202' },
  { name: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431, zip: '78701' },
  { name: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611, zip: '92101' },
  { name: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652, zip: '19102' },
  { name: 'Nashville', state: 'TN', lat: 36.1627, lng: -86.7816, zip: '37203' },
  { name: 'Charlotte', state: 'NC', lat: 35.2271, lng: -80.8431, zip: '28202' },
  { name: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398, zip: '89101' },
  { name: 'Portland', state: 'OR', lat: 45.5152, lng: -122.6784, zip: '97201' },
]

const nameAdjectives = [
  'Modern', 'Elite', 'Luxe', 'Radiant', 'Pure', 'Glow', 'Bloom', 'Vivid',
  'Serene', 'Bright', 'Refined', 'Polished', 'Golden', 'Silver', 'Urban',
  'Coastal', 'Metro', 'Renew', 'Essence', 'Harbor',
]
const nameSuffixes = [
  'Aesthetics', 'Med Spa', 'Dermatology', 'Injectables', 'Skin Studio',
  'Wellness', 'Beauty Bar', 'Cosmetic Center', 'Rejuvenation', 'Aesthetic Clinic',
]
const streetNames = [
  'Main St', 'Oak Ave', 'Elm St', 'Park Blvd', 'Broadway', 'Market St',
  'Sunset Blvd', '5th Ave', 'Center St', 'Highland Ave', 'Riverside Dr', 'Lincoln Ave',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function kebab(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
function fakePhone(): string {
  const area = 200 + Math.floor(Math.random() * 700)
  const rest = 1000000 + Math.floor(Math.random() * 8999999)
  return `+1${area}${rest}`
}

async function main() {
  const count = (() => {
    const arg = process.argv.find((a) => a.startsWith('--count='))
    return arg ? parseInt(arg.split('=')[1], 10) : 3000
  })()

  console.log(`\n===== seed-dummy-clinics: target ${count} =====\n`)
  const payload = await getPayload({ config })

  const [servicesRes, brandsRes] = await Promise.all([
    payload.find({ collection: 'services', limit: 1000, depth: 0 }),
    payload.find({ collection: 'brands', limit: 200, depth: 0 }),
  ])
  if (servicesRes.docs.length === 0 || brandsRes.docs.length === 0) {
    console.error('No services/brands found. Run `npm run seed` first to seed the baseline data.')
    process.exit(1)
  }
  const serviceIds = servicesRes.docs.map((d: any) => d.id)
  const brandIds = brandsRes.docs.map((d: any) => d.id)

  const existing = await payload.find({
    collection: 'clinics',
    where: { clinicId: { like: 'dummy-' } } as any,
    limit: 1,
  })
  const already = existing.totalDocs
  const toCreate = count - already
  if (toCreate <= 0) {
    console.log(`Already have ${already} dummy clinics (>= target ${count}). Nothing to do.`)
    process.exit(0)
  }
  console.log(`${already} dummy clinics exist. Creating ${toCreate} more...\n`)

  for (let i = already; i < already + toCreate; i++) {
    const metro = pick(metros)
    const name = `${pick(nameAdjectives)} ${pick(nameSuffixes)}`
    const clinicId = `dummy-${String(i).padStart(6, '0')}`
    const slug = `${kebab(name)}-${i}`
    const streetNum = 100 + Math.floor(Math.random() * 9800)

    const numServices = 2 + Math.floor(Math.random() * 3)
    const numBrands = 1 + Math.floor(Math.random() * 2)
    const shuffledServices = [...serviceIds].sort(() => Math.random() - 0.5).slice(0, numServices)
    const shuffledBrands = [...brandIds].sort(() => Math.random() - 0.5).slice(0, numBrands)

    try {
      await payload.create({
        collection: 'clinics',
        data: {
          clinicId,
          clinicName: name,
          slug,
          clinicType: pick(['medspa', 'dermatology', 'plastic-surgery']),
          serviceType: 'In-Person',
          addressLine1: `${streetNum} ${pick(streetNames)}`,
          city: metro.name,
          state: metro.state,
          zip: metro.zip,
          country: 'US',
          latitude: metro.lat + (Math.random() - 0.5) * 0.08,
          longitude: metro.lng + (Math.random() - 0.5) * 0.08,
          phone: fakePhone(),
          websiteUrl: `https://example.com/${slug}`,
          servicesOffered: shuffledServices,
          brandsOffered: shuffledBrands,
          acceptsNewPatients: true,
          offersVirtualConsult: false,
          languages: ['en'],
          status: 'published',
          needsManualReview: false,
        } as any,
      })
    } catch (err: any) {
      console.error(`Failed on ${clinicId}: ${err.message}`)
    }

    if ((i + 1) % 250 === 0) console.log(`  ${i + 1 - already}/${toCreate} created...`)
  }

  console.log(`\n===== done: ${toCreate} dummy clinics created =====\n`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
