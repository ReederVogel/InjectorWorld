/**
 * Fake-but-realistic data generator for injector.world (4 launch states: CA/TX/NY/FL).
 *
 * Writes data/fake/{clinics,providers,reviews,photos,qa}.csv matching the
 * data/scraper-brief.md schemas + the locked rules:
 *   - snake_case headers (importer maps to camelCase)
 *   - relationship references are the raw business ids (clinic_id / provider_id)
 *   - any field containing a comma / quote / newline is CSV-quoted (serializer below)
 *
 * Deterministic: a fixed PRNG seed means re-running produces identical output.
 * Faults are CURATED at known rows so EXPECTED.md counts are exact (organic
 * randomness is used only for benign variety: ratings, treatments, review counts).
 *
 * The importer (npm run import) ingests clinics/providers/reviews ONLY. photos.csv
 * and qa.csv are generated future-ready (their importers do not exist yet).
 *
 * Usage:  npx tsx scripts/gen-fake-data.ts
 */
import fs from 'fs'
import path from 'path'

// ----------------------------- deterministic PRNG -----------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(20260609)
const rand = () => rng()
const randint = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]
const pickN = <T,>(arr: T[], n: number): T[] => {
  const copy = [...arr]
  const out: T[] = []
  for (let i = 0; i < n && copy.length; i++) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0])
  return out
}
const chance = (p: number) => rand() < p

// ----------------------------- CSV serializer -----------------------------
function csvCell(v: unknown): string {
  if (v === undefined || v === null) return ''
  const s = String(v)
  if (s === '') return ''
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}
function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.join(',')]
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(','))
  return lines.join('\n') + '\n'
}

// ----------------------------- data pools -----------------------------
const FIRST = [
  'Sarah', 'Marcus', 'Priya', 'David', 'Elena', 'Olivia', 'Daniel', 'Sofia', 'James', 'Maya',
  'Aaron', 'Nadia', 'Victor', 'Grace', 'Leo', 'Hana', 'Ruben', 'Claire', 'Omar', 'Tessa',
  'Felix', 'Isabel', 'Noah', 'Camila', 'Ethan', 'Lara', 'Diego', 'Anya', 'Caleb', 'Nina',
  'Jonah', 'Renee', 'Theo', 'Bianca', 'Miles', 'Yara', 'Adrian', 'Selena', 'Paul', 'Dahlia',
]
const LAST = [
  'Kim', 'Allen', 'Nair', 'Stern', 'Cruz', 'Bennett', 'Okafor', 'Reyes', 'Whitman', 'Patel',
  'Voss', 'Delgado', 'Harlow', 'Mercer', 'Tran', 'Bauer', 'Sandoval', 'Quinn', 'Abboud', 'Frost',
  'Castellano', 'Yu', 'Romero', 'Nguyen', 'Schwartz', 'Ibrahim', 'Pearce', 'Lindqvist', 'Marsh', 'Ortiz',
]
const CREDS = ['MD', 'DO', 'NP', 'PA', 'RN']
const TITLE_BY_CRED: Record<string, string[]> = {
  MD: ['Board-Certified Dermatologist', 'Board-Certified Plastic Surgeon', 'Facial Plastic Surgeon', 'Cosmetic Physician'],
  DO: ['Cosmetic Physician', 'Aesthetic Medicine Physician'],
  NP: ['Aesthetic Nurse Practitioner', 'Cosmetic Nurse Practitioner'],
  PA: ['Physician Assistant, Aesthetic Medicine', 'Aesthetic Physician Assistant'],
  RN: ['Aesthetic Registered Nurse', 'Cosmetic Registered Nurse'],
}
const CERTS = ['Dermatology, ABD', 'AAD Fellow', 'Plastic Surgery, ABPS', 'Facial Plastic Surgery, ABFPRS', 'Aesthetic Medicine, AAAM']
const LANGS = ['English', 'Spanish', 'Mandarin', 'Korean', 'Hindi', 'Russian', 'French', 'Portuguese', 'Arabic', 'Vietnamese']
const GENDERS = ['Female', 'Male', 'Non-binary', 'Unknown']
// CSV labels that DO resolve to a DB treatment (via helpers TREATMENT_ALIASES / slug match).
const VALID_TREATMENTS = [
  'Botox', 'Dysport', 'Xeomin', 'Jeuveau', 'Daxxify', 'Lip Filler', 'Cheek Filler',
  'Jawline Filler', 'Tear Trough', 'Masseter Botox', 'Kybella', 'Sculptra', 'PRP',
  'Microneedling', 'Thread Lift',
]
// Labels that DON'T resolve -> should raise unknown_treatment.
const BOGUS_TREATMENTS = ['Fat Dissolving', 'Vampire Facial', 'CO2 Laser', 'Fraxel', 'Morpheus8', 'IPL Photofacial']
const SPECIALTIES = ['Forehead', "Crow's Feet", 'Tear Trough', 'Masseter', 'Jawline', 'Cheeks', 'Lips', 'Mid-face', 'Neck', 'Skin']
const PAYMENTS = ['Visa', 'Mastercard', 'Amex', 'Care Credit', 'Cherry']
const AMENITIES = ['Parking', 'Wheelchair accessible', 'Wi-Fi', 'Virtual consults', 'Private suites']
const PLATFORMS = ['google', 'yelp', 'healthgrades', 'vitals', 'zocdoc', 'clinic_site']
const AGE_RANGES = ['25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59']
const LOYALTY = ['alle', 'aspire', 'xperience', 'other']

type City = { city: string; state: string; county: string; lat: number; lng: number; zipBase: number; hoods: string[]; matched: boolean }
const CITIES: Record<string, City[]> = {
  CA: [
    { city: 'Los Angeles', state: 'CA', county: 'Los Angeles County', lat: 34.0522, lng: -118.2437, zipBase: 90012, matched: true, hoods: ['West Hollywood', 'Beverly Grove', 'Brentwood', 'Silver Lake', 'Studio City'] },
    { city: 'San Francisco', state: 'CA', county: 'San Francisco County', lat: 37.7749, lng: -122.4194, zipBase: 94109, matched: true, hoods: ['Pacific Heights', 'Marina District', 'SoMa', 'Nob Hill', 'Hayes Valley'] },
    { city: 'San Diego', state: 'CA', county: 'San Diego County', lat: 32.7157, lng: -117.1611, zipBase: 92101, matched: true, hoods: ['La Jolla', 'Gaslamp Quarter', 'Hillcrest', 'Little Italy'] },
    { city: 'Beverly Hills', state: 'CA', county: 'Los Angeles County', lat: 34.0736, lng: -118.4004, zipBase: 90210, matched: false, hoods: ['Golden Triangle', 'Trousdale Estates'] },
    { city: 'Sacramento', state: 'CA', county: 'Sacramento County', lat: 38.5816, lng: -121.4944, zipBase: 95814, matched: false, hoods: ['Midtown', 'East Sacramento'] },
  ],
  TX: [
    { city: 'Houston', state: 'TX', county: 'Harris County', lat: 29.7604, lng: -95.3698, zipBase: 77002, matched: true, hoods: ['River Oaks', 'Montrose', 'Memorial', 'Uptown', 'The Heights'] },
    { city: 'Dallas', state: 'TX', county: 'Dallas County', lat: 32.7767, lng: -96.797, zipBase: 75201, matched: true, hoods: ['Uptown', 'Highland Park', 'Knox-Henderson', 'Deep Ellum'] },
    { city: 'Austin', state: 'TX', county: 'Travis County', lat: 30.2672, lng: -97.7431, zipBase: 78701, matched: true, hoods: ['Downtown', 'Westlake', 'South Congress', 'Tarrytown'] },
    { city: 'San Antonio', state: 'TX', county: 'Bexar County', lat: 29.4241, lng: -98.4936, zipBase: 78205, matched: false, hoods: ['Alamo Heights', 'Stone Oak'] },
    { city: 'Fort Worth', state: 'TX', county: 'Tarrant County', lat: 32.7555, lng: -97.3308, zipBase: 76102, matched: false, hoods: ['Sundance Square', 'Cultural District'] },
  ],
  NY: [
    { city: 'New York', state: 'NY', county: 'New York County', lat: 40.7128, lng: -73.999, zipBase: 10001, matched: true, hoods: ['Upper East Side', 'Tribeca', 'SoHo', 'Flatiron', 'Midtown', 'Greenwich Village'] },
    { city: 'Brooklyn', state: 'NY', county: 'Kings County', lat: 40.6782, lng: -73.9442, zipBase: 11201, matched: false, hoods: ['Williamsburg', 'Park Slope', 'DUMBO'] },
    { city: 'Buffalo', state: 'NY', county: 'Erie County', lat: 42.8864, lng: -78.8784, zipBase: 14202, matched: false, hoods: ['Elmwood Village', 'Allentown'] },
  ],
  FL: [
    { city: 'Miami', state: 'FL', county: 'Miami-Dade County', lat: 25.7617, lng: -80.1918, zipBase: 33131, matched: true, hoods: ['Brickell', 'Coral Gables', 'South Beach', 'Wynwood', 'Coconut Grove'] },
    { city: 'Tampa', state: 'FL', county: 'Hillsborough County', lat: 27.9506, lng: -82.4572, zipBase: 33602, matched: false, hoods: ['Hyde Park', 'Channelside'] },
    { city: 'Orlando', state: 'FL', county: 'Orange County', lat: 28.5383, lng: -81.3792, zipBase: 32801, matched: false, hoods: ['Thornton Park', 'Winter Park'] },
  ],
}

// Mirror of the importer's slug derivation so we can guarantee unique slugs in the
// clean/base data (the importer rejects a duplicate slug with an "invalid: slug" error).
function kebab(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }
function provSlug(name: string, cred: string, city: string) { return [kebab(name), cred.toLowerCase(), kebab(city)].filter(Boolean).join('-') }
const usedClinicSlugs = new Set<string>()
const usedProviderSlugs = new Set<string>()
function uniqueClinicName(base: string) {
  let name = base
  let n = 1
  while (usedClinicSlugs.has(kebab(name))) name = `${base} ${++n}`
  usedClinicSlugs.add(kebab(name))
  return name
}

const CLINIC_NOUNS = ['Aesthetics', 'Dermatology', 'Med Spa', 'Skin Studio', 'Cosmetic Clinic', 'Injectables', 'Aesthetic Medicine', 'Skin & Laser']
const CLINIC_ADJ = ['Madison', 'Park Avenue', 'Sunset', 'Bayou', 'Lakeshore', 'Coastal', 'Summit', 'Magnolia', 'Crescent', 'Harbor', 'Vista', 'Aurora', 'Lumen', 'Verde', 'Onyx', 'Solace', 'Mosaic', 'Cedar', 'Halcyon', 'Marble']

const REVIEW_TITLES = [
  'Natural and exactly right', 'Best in the city', 'So happy with my results', 'Subtle and balanced',
  'Felt heard and informed', 'Worth every penny', 'Conservative approach I trust', 'Great masseter result',
  'No more downtime worries', 'Looks like me, just rested', 'Will be back', 'Clean and professional',
]
const REVIEW_OPEN = [
  'Took the time to map my face before any injection.', 'Explained every step and never upsold me.',
  'Honest about what would and would not help.', 'The whole team was warm and the office was spotless.',
  'Booked a consult first and felt zero pressure.', 'Walked me through the plan and the pricing up front.',
]
const REVIEW_CLOSE = [
  'The result is subtle and natural.', 'No one has guessed I had anything done.',
  'Healed fast with barely any bruising.', 'I finally look as rested as I feel.',
  'Already booked my follow-up.', 'Exactly the balanced look I wanted.',
]
const RESPONSE_TEXTS = [
  'Thank you so much, see you at your next visit.',
  'We appreciate the kind words, it was a pleasure caring for you.',
  'Thank you, we are glad you love your results.',
]
const QA_TEMPLATES = [
  { q: 'How long does {t} last?', a: 'For most patients {t} results last several months, then gradually soften. Timing varies by dose, metabolism, and area treated. A maintenance plan keeps results consistent.' },
  { q: 'Is there downtime after {t}?', a: 'Downtime for {t} is usually minimal. Mild redness or swelling can occur and typically settles within a day or two. Most people return to normal activities the same day.' },
  { q: 'Does {t} hurt?', a: 'Discomfort with {t} is generally mild. Numbing cream or ice is used for comfort, and most patients describe a quick pinch rather than real pain.' },
  { q: 'Am I a good candidate for {t}?', a: 'A good candidate for {t} is in good general health with realistic goals. A consultation reviews your history and anatomy before any treatment is recommended.' },
]

// ----------------------------- accumulators -----------------------------
type Row = Record<string, unknown>
const clinics: Row[] = []
const providers: Row[] = []
const reviews: Row[] = []
const photos: Row[] = []
const qa: Row[] = []
const faultLog: string[] = []

let provSeq = 0
let revSeq = 0
let photoSeq = 0
let qaSeq = 0
// Offset fake review ids well clear of the seed's rev-00000001.. range so importing
// this dataset never clobbers the ~40 seeded mock reviews. (Seed: scripts/seed-data.ts.)
const REV_OFFSET = 50_000_000
const revId = () => `rev-${String(REV_OFFSET + revSeq).padStart(8, '0')}`
const SOURCE = 'https://injector.world/fake-dataset'
const SCRAPED = '2026-06-08'

const stateCodeLower = (s: string) => s.toLowerCase()
function placeId(tag: string) {
  // deterministic-ish 22-char place id
  let s = ''
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  for (let i = 0; i < 16; i++) s += alpha[Math.floor(rand() * alpha.length)]
  return `ChIJ${tag}${s}`
}
function phoneFor(state: string) {
  const area = state === 'CA' ? pick(['213', '310', '415', '619']) : state === 'TX' ? pick(['713', '214', '512', '210']) : state === 'NY' ? pick(['212', '718', '917']) : pick(['305', '786', '813', '407'])
  return `+1${area}555${String(randint(100, 199)).padStart(4, '0')}`
}
function jitter(base: number) { return Number((base + (rand() - 0.5) * 0.08).toFixed(6)) }
function reviewText() { return `${pick(REVIEW_OPEN)} ${pick(REVIEW_CLOSE)}` }
function recentDate(maxDaysAgo: number) {
  const d = new Date('2026-06-08')
  d.setDate(d.getDate() - randint(1, maxDaysAgo))
  return d.toISOString().slice(0, 10)
}

// ----------------------------- clinic + provider builders -----------------------------
function makeClinicName(city: City) {
  return `${pick(CLINIC_ADJ)} ${pick(CLINIC_NOUNS)} ${city.hoods.length ? pick(city.hoods).split(' ')[0] : ''}`.trim()
}

function buildClinic(opts: {
  id: string; city: City; name?: string; phone?: string; website?: string; place?: string
  noCoords?: boolean; noSource?: boolean; badZip?: boolean; badGeo?: boolean; noPhone?: boolean; blankName?: boolean
  allowDupName?: boolean
}): Row {
  const { city } = opts
  // Unique slug guard: only for auto-generated, non-blank names that are not an
  // intentional duplicate-name fault.
  const name = opts.blankName
    ? ''
    : opts.allowDupName
      ? (opts.name ?? makeClinicName(city))
      : uniqueClinicName(opts.name ?? makeClinicName(city))
  const slugBase = name || opts.id
  const website = opts.website ?? `https://${slugBase.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example`
  let lat: number | string = jitter(city.lat)
  let lng: number | string = jitter(city.lng)
  if (opts.noCoords) { lat = ''; lng = '' }
  if (opts.badGeo) { lat = 999.123456; lng = jitter(city.lng) } // out-of-range latitude
  const zip = opts.badZip ? pick(['ABCDE', '9001', '00000']) : String(city.zipBase + randint(0, 30))
  const phone = opts.noPhone ? '' : opts.phone ?? phoneFor(city.state)
  const hood = city.hoods.length ? pick(city.hoods) : ''
  const photoUrls = [`https://picsum.photos/seed/${opts.id}-a/600/400`, `https://picsum.photos/seed/${opts.id}-b/600/400`].join('; ')
  return {
    clinic_id: opts.id,
    clinic_name: name,
    tagline: `${hood || city.city} injectable specialists.`,
    description: `A ${hood || city.city} practice focused on natural, conservative injectable results, with an emphasis on patient education before treatment.`,
    address_line_1: `${randint(100, 9999)} ${pick(['Main', 'Park', 'Sunset', 'Oak', 'Harbor', 'Lake', 'Cedar', 'Magnolia'])} ${pick(['Street', 'Avenue', 'Boulevard', 'Drive'])}`,
    address_line_2: chance(0.5) ? `Suite ${randint(100, 900)}` : '',
    city: city.city, state: city.state, zip,
    neighborhood: hood, county: city.county, country: 'US',
    latitude: lat, longitude: lng,
    google_place_id: opts.place ?? placeId(stateCodeLower(city.state)),
    google_maps_url: `https://maps.google.com/?cid=${randint(10000000, 99999999)}`,
    directions_url: lat === '' ? '' : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    apple_maps_url: lat === '' ? '' : `https://maps.apple.com/?ll=${lat},${lng}`,
    phone,
    email: `hello@${slugBase.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example`,
    website_url: website,
    booking_url: chance(0.6) ? `${website}/book` : '',
    hours_json: chance(0.7) ? JSON.stringify({ mon: '9-18', tue: '9-18', wed: '9-18', thu: '9-19', fri: '9-17', sat: 'closed', sun: 'closed' }) : '',
    service_type: pick(['In-Person', 'In-Person', 'Both']),
    accepts_insurance: chance(0.2) ? 'true' : 'false',
    payment_methods: pickN(PAYMENTS, randint(2, 4)).join('; '),
    amenities: pickN(AMENITIES, randint(2, 4)).join('; '),
    logo_url: `https://picsum.photos/seed/${opts.id}-logo/200/200`,
    clinic_photo_urls: photoUrls,
    aggregate_rating: (4 + rand()).toFixed(1),
    aggregate_rating_count: randint(20, 480),
    provider_ids: '', // filled after providers built
    year_established: randint(2004, 2022),
    source_urls: opts.noSource ? '' : SOURCE,
    last_scraped_date: SCRAPED,
  }
}

function buildProvider(opts: {
  id: string; clinicId: string; city: City; name?: string; cred?: string
  license?: string; licenseState?: string; npi?: string; status?: string
  treatments?: string[]; noSource?: boolean; noPhoto?: boolean; noLicense?: boolean
  badCred?: boolean; badStatus?: boolean; dirtyPhone?: boolean
}): Row {
  provSeq++
  const cred = opts.badCred ? 'DNP' : opts.cred ?? pick(CREDS)
  // Unique slug guard for auto-generated names (importer rejects duplicate provider
  // slug = name+credentials+city). Provided names (e.g. duplicate-provider fault) are
  // left as-is; those rows are skipped at dedupe before any slug is created.
  let name: string
  if (opts.name) {
    name = opts.name
  } else {
    do { name = `${pick(FIRST)} ${pick(LAST)}` } while (usedProviderSlugs.has(provSlug(name, cred, opts.city.city)))
    usedProviderSlugs.add(provSlug(name, cred, opts.city.city))
  }
  const treatments = opts.treatments ?? pickN(VALID_TREATMENTS, randint(2, 5))
  const lic = opts.noLicense ? '' : opts.license ?? `${opts.licenseState ?? opts.city.state}${randint(10000, 999999)}`
  const phone = opts.dirtyPhone ? pick(['(305) 555-0123', '305.555.0188', '555-0100']) : `+1${randint(2, 9)}${randint(10, 99)}555${randint(1000, 1999)}`
  const verifUrl = opts.city.state === 'CA' ? 'https://search.dca.ca.gov/' : opts.city.state === 'TX' ? 'https://profile.tmb.state.tx.us/Lookup' : opts.city.state === 'NY' ? 'https://op.nysed.gov/verification-search' : 'https://appsmqa.doh.state.fl.us/MQASearchServices/'
  return {
    provider_id: opts.id,
    full_name: name,
    credentials: cred,
    title: pick(TITLE_BY_CRED[cred] ?? ['Cosmetic Physician']),
    board_certifications: chance(0.6) ? pickN(CERTS, randint(1, 2)).join('; ') : '',
    license_number: lic,
    license_state: opts.licenseState ?? opts.city.state,
    license_status: opts.badStatus ? 'Lapsed' : opts.status ?? pick(['Active', 'Active', 'Active', 'Inactive', 'Expired']),
    license_verification_url: verifUrl,
    npi_number: opts.npi ?? (['NP', 'RN'].includes(cred) && chance(0.3) ? '' : String(19_0000_0000 + provSeq)),
    years_experience: randint(3, 25),
    year_started_practicing: randint(2001, 2022),
    clinic_id: opts.clinicId,
    tagline: `${pick(['Conservative', 'Natural', 'Detail-focused', 'Patient-first'])} ${pick(treatments).toLowerCase()} in ${opts.city.city}.`,
    bio: `${name.split(' ')[0]} focuses on natural, balanced results and spends time on assessment before any treatment. Known for a conservative, education-first approach.`,
    profile_photo_url: opts.noPhoto ? '' : `https://i.pravatar.cc/200?img=${randint(1, 70)}`,
    languages: ['English', ...(chance(0.5) ? pickN(LANGS.slice(1), randint(1, 2)) : [])].join('; '),
    gender: pick(GENDERS),
    treatments_offered: treatments.join('; '),
    specialties: pickN(SPECIALTIES, randint(2, 3)).join('; '),
    services_offered: ['Consultation', ...treatments].join('; '),
    pricing_botox_per_unit: chance(0.85) ? randint(11, 20) : '',
    pricing_filler_per_syringe: chance(0.8) ? randint(650, 1200) : '',
    pricing_consultation: chance(0.7) ? pick([0, 50, 75, 100, 150]) : '',
    accepts_new_patients: chance(0.85) ? 'true' : 'false',
    offers_virtual_consult: chance(0.4) ? 'true' : 'false',
    offers_in_person: 'true',
    website_url: chance(0.5) ? `https://provider-${opts.id}.example` : '',
    email: chance(0.6) ? `${name.split(' ')[0].toLowerCase()}@clinic.example` : '',
    phone_direct: phone,
    instagram_url: chance(0.4) ? `https://instagram.com/${name.split(' ')[0].toLowerCase()}aesthetics` : '',
    tiktok_url: '',
    linkedin_url: '',
    aggregate_rating: (4 + rand()).toFixed(1),
    aggregate_rating_count: randint(8, 320),
    source_urls: opts.noSource ? '' : SOURCE,
    last_scraped_date: SCRAPED,
  }
}

function buildReviewsFor(prov: Row, clinicId: string, city: City) {
  const n = randint(5, 30)
  const provId = prov.provider_id as string
  const treatments = String(prov.treatments_offered).split('; ')
  for (let i = 0; i < n; i++) {
    revSeq++
    const rating = chance(0.78) ? 5 : chance(0.7) ? 4 : randint(1, 3)
    const hasResp = chance(0.25)
    const respDate = hasResp ? recentDate(700) : ''
    reviews.push({
      review_id: `${revId()}`,
      provider_id: provId,
      clinic_id: clinicId,
      reviewer_first_name: pick(FIRST),
      reviewer_initial: pick('ABCDEFGHJKLMNPRSTW'.split('')),
      reviewer_age_range: pick(AGE_RANGES),
      reviewer_city: city.hoods.length ? pick(city.hoods) : city.city,
      rating,
      review_title: pick(REVIEW_TITLES),
      review_text: reviewText(),
      treatment_tag: pick(treatments),
      review_date: recentDate(720),
      source_platform: pick(PLATFORMS),
      source_url: `https://${pick(PLATFORMS)}.example/r/${revSeq}`,
      response_from_provider: hasResp ? pick(RESPONSE_TEXTS) : '',
      response_date: respDate,
    })
  }
}

// ----------------------------- 1) BASE (clean) clinics + providers + reviews -----------------------------
const STATE_CLINIC_COUNT: Record<string, number> = { CA: 18, TX: 16, NY: 14, FL: 12 }
const clinicCityMap: Record<string, City> = {}
const validProviderIds: string[] = []

// monotonic provider-number counter for ids (decoupled from provSeq used in builder for npi)
let provSeqGlobalN = 0
const provSeqGlobal = () => ++provSeqGlobalN

for (const state of ['CA', 'TX', 'NY', 'FL']) {
  const matchedCities = CITIES[state].filter((c) => c.matched)
  let made = 0
  let idx = 1
  while (made < STATE_CLINIC_COUNT[state]) {
    const city = matchedCities[made % matchedCities.length]
    const clinicId = `clinic-${stateCodeLower(state)}-${String(idx).padStart(5, '0')}`
    const clinic = buildClinic({ id: clinicId, city })
    clinics.push(clinic)
    clinicCityMap[clinicId] = city
    // providers for this clinic
    const provCount = randint(1, 4)
    const ids: string[] = []
    for (let p = 0; p < provCount; p++) {
      const provId = `prov-${stateCodeLower(state)}-${String(provSeqGlobal()).padStart(5, '0')}`
      const prov = buildProvider({ id: provId, clinicId, city })
      providers.push(prov)
      ids.push(provId)
      validProviderIds.push(provId)
      buildReviewsFor(prov, clinicId, city)
    }
    clinic.provider_ids = ids.join('; ')
    made++
    idx++
  }
}

// ----------------------------- 2) CURATED FAULTS -----------------------------
// Helper to grab a base clinic in a matched city of a state.
const baseClinicOf = (state: string) => clinics.find((c) => c.state === state && CITIES[state].find((ci) => ci.city === c.city && ci.matched))!
const cityByName = (state: string, name: string) => CITIES[state].find((c) => c.city === name)!

let fSeq = 900
const fClinicId = () => `clinic-fault-${String(++fSeq).padStart(5, '0')}`
const fProvId = () => `prov-fault-${String(++fSeq).padStart(5, '0')}`

// (a) unmatched_city: 2 clinics per state in non-metro cities  -> 8 info alerts
for (const state of ['CA', 'TX', 'NY', 'FL']) {
  const unmatched = CITIES[state].filter((c) => !c.matched).slice(0, 2)
  for (const city of unmatched) {
    const id = fClinicId()
    clinics.push(buildClinic({ id, city }))
    clinicCityMap[id] = city
    faultLog.push(`unmatched_city (info): ${id} in ${city.city}, ${state}`)
    // give it one valid provider so it is a real listing
    const pid = fProvId()
    providers.push(buildProvider({ id: pid, clinicId: id, city }))
    validProviderIds.push(pid)
  }
}

// (b) missing_coordinates: 3 clinics, no lat/lng -> 3 error alerts (skipped)
for (let i = 0; i < 3; i++) {
  const city = baseClinicCity(['CA', 'TX', 'FL'][i])
  const id = fClinicId()
  clinics.push(buildClinic({ id, city, noCoords: true }))
  faultLog.push(`missing_coordinates (error, skipped): ${id}`)
}
function baseClinicCity(state: string) { return CITIES[state].find((c) => c.matched)! }

// (c) missing_source on clinic: 3 -> 3 warning alerts
for (let i = 0; i < 3; i++) {
  const city = baseClinicCity(['NY', 'TX', 'CA'][i])
  const id = fClinicId()
  const c = buildClinic({ id, city, noSource: true })
  clinics.push(c)
  clinicCityMap[id] = city
  faultLog.push(`missing_source clinic (warning): ${id}`)
  const pid = fProvId(); providers.push(buildProvider({ id: pid, clinicId: id, city })); validProviderIds.push(pid)
}

// (d) duplicate_clinic: 3 clinics share google_place_id with an existing base clinic -> 3 warning alerts
for (let i = 0; i < 3; i++) {
  const state = ['CA', 'TX', 'FL'][i]
  const base = baseClinicOf(state)
  const city = clinicCityMap[base.clinic_id as string]
  const id = fClinicId()
  const dup = buildClinic({ id, city, place: base.google_place_id as string })
  clinics.push(dup)
  clinicCityMap[id] = city
  faultLog.push(`duplicate_clinic (warning): ${id} shares google_place_id with ${base.clinic_id}`)
}

// (e) blank clinic_name: 2 -> broken_relationship error (skipped)
for (let i = 0; i < 2; i++) {
  const city = baseClinicCity(['NY', 'FL'][i])
  const id = fClinicId()
  clinics.push(buildClinic({ id, city, blankName: true }))
  faultLog.push(`clinic missing name -> broken_relationship (error, skipped): ${id}`)
}

// (f) blank clinic phone (required) -> "other" error (failed create)
{
  const city = baseClinicCity('CA')
  const id = fClinicId()
  clinics.push(buildClinic({ id, city, noPhone: true }))
  faultLog.push(`clinic missing required phone -> other (error, failed create): ${id}`)
}

// (g) bad zip (carried, NO alert today): 4 clinics
for (let i = 0; i < 4; i++) {
  const state = ['CA', 'TX', 'NY', 'FL'][i]
  const city = baseClinicCity(state)
  const id = fClinicId()
  const c = buildClinic({ id, city, badZip: true })
  clinics.push(c); clinicCityMap[id] = city
  faultLog.push(`bad zip (CARRIED, no detector): ${id} zip=${c.zip}`)
  const pid = fProvId(); providers.push(buildProvider({ id: pid, clinicId: id, city })); validProviderIds.push(pid)
}

// (h) out-of-range latitude (carried, imports silently): 3 clinics
for (let i = 0; i < 3; i++) {
  const state = ['TX', 'FL', 'CA'][i]
  const city = baseClinicCity(state)
  const id = fClinicId()
  const c = buildClinic({ id, city, badGeo: true })
  clinics.push(c); clinicCityMap[id] = city
  faultLog.push(`out-of-range latitude (CARRIED, no detector): ${id} lat=${c.latitude}`)
  const pid = fProvId(); providers.push(buildProvider({ id: pid, clinicId: id, city })); validProviderIds.push(pid)
}

// (i) BRANDS: 2 brands x 3 branches (same name-base + phone + website, distinct place ids/cities)
//     Carried for future branch auto-suggest detector; no alert today.
const BRANDS = [
  { base: 'Radiance Aesthetics', state: 'CA', cities: ['Los Angeles', 'San Diego', 'San Francisco'] },
  { base: 'Lone Star Med Spa', state: 'TX', cities: ['Houston', 'Dallas', 'Austin'] },
]
for (const b of BRANDS) {
  const phone = phoneFor(b.state)
  const website = `https://${b.base.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example`
  for (const cn of b.cities) {
    const city = cityByName(b.state, cn)
    const id = fClinicId()
    const name = `${b.base} ${cn}`
    const c = buildClinic({ id, city, name, phone, website })
    clinics.push(c); clinicCityMap[id] = city
    const pid = fProvId(); providers.push(buildProvider({ id: pid, clinicId: id, city })); validProviderIds.push(pid)
    c.provider_ids = pid
  }
  faultLog.push(`brand branches (CARRIED, no detector): "${b.base}" x${b.cities.length} (same phone+website)`)
}

// (j) duplicate_provider: 4 providers reuse name+state+license of an existing base provider -> 4 warning (skipped)
for (let i = 0; i < 4; i++) {
  const orig = providers.find((p) => validProviderIds.includes(p.provider_id as string) && p.license_number)!
  // pick distinct originals
  const candidates = providers.filter((p) => validProviderIds.includes(p.provider_id as string) && p.license_number)
  const src = candidates[i * 3 % candidates.length]
  const city = clinicCityMap[src.clinic_id as string]
  const id = fProvId()
  providers.push(buildProvider({
    id, clinicId: src.clinic_id as string, city,
    name: src.full_name as string, license: src.license_number as string, licenseState: src.license_state as string,
  }))
  faultLog.push(`duplicate_provider (warning, skipped): ${id} == ${src.provider_id} (${src.full_name})`)
}

// (k) provider -> nonexistent clinic: 3 -> broken_relationship error (skipped)
for (let i = 0; i < 3; i++) {
  const city = baseClinicCity(['CA', 'NY', 'TX'][i])
  const id = fProvId()
  providers.push(buildProvider({ id, clinicId: `clinic-does-not-exist-${i}`, city }))
  faultLog.push(`provider -> missing clinic (error, skipped): ${id}`)
}

// (l) provider with only unknown treatments: 2 -> broken_relationship error (skipped)
for (let i = 0; i < 2; i++) {
  const state = ['FL', 'CA'][i]
  const clinic = baseClinicOf(state)
  const city = clinicCityMap[clinic.clinic_id as string]
  const id = fProvId()
  providers.push(buildProvider({ id, clinicId: clinic.clinic_id as string, city, treatments: pickN(BOGUS_TREATMENTS, 2) }))
  faultLog.push(`provider only-unknown-treatments (error, skipped): ${id}`)
}

// (m) unknown_treatment mix (valid + bogus): 6 -> warning (valid kept)
for (let i = 0; i < 6; i++) {
  const state = ['CA', 'TX', 'NY', 'FL', 'CA', 'TX'][i]
  const clinic = baseClinicOf(state)
  const city = clinicCityMap[clinic.clinic_id as string]
  const id = fProvId()
  providers.push(buildProvider({ id, clinicId: clinic.clinic_id as string, city, treatments: ['Botox', pick(BOGUS_TREATMENTS)] }))
  validProviderIds.push(id)
  faultLog.push(`unknown_treatment (warning, valid kept): ${id}`)
}

// (n) provider missing source_urls: 4 -> missing_source warning
for (let i = 0; i < 4; i++) {
  const state = ['NY', 'FL', 'TX', 'CA'][i]
  const clinic = baseClinicOf(state)
  const city = clinicCityMap[clinic.clinic_id as string]
  const id = fProvId()
  providers.push(buildProvider({ id, clinicId: clinic.clinic_id as string, city, noSource: true }))
  validProviderIds.push(id)
  faultLog.push(`provider missing_source (warning): ${id}`)
}

// (o) provider missing photo: 6 -> missing_trust_field info
for (let i = 0; i < 6; i++) {
  const state = ['CA', 'TX', 'NY', 'FL', 'CA', 'NY'][i]
  const clinic = baseClinicOf(state)
  const city = clinicCityMap[clinic.clinic_id as string]
  const id = fProvId()
  providers.push(buildProvider({ id, clinicId: clinic.clinic_id as string, city, noPhoto: true }))
  validProviderIds.push(id)
  faultLog.push(`provider missing_trust_field/no-photo (info): ${id}`)
}

// (p) provider missing license_number (required) : 2 -> other error (failed create)
for (let i = 0; i < 2; i++) {
  const state = ['TX', 'CA'][i]
  const clinic = baseClinicOf(state)
  const city = clinicCityMap[clinic.clinic_id as string]
  const id = fProvId()
  providers.push(buildProvider({ id, clinicId: clinic.clinic_id as string, city, noLicense: true }))
  faultLog.push(`provider missing required license_number -> other (error): ${id}`)
}

// (q) bad enum: 2 bad credentials (DNP) + 1 bad license_status (Lapsed) -> other error
for (let i = 0; i < 2; i++) {
  const clinic = baseClinicOf(['NY', 'FL'][i])
  const city = clinicCityMap[clinic.clinic_id as string]
  const id = fProvId()
  providers.push(buildProvider({ id, clinicId: clinic.clinic_id as string, city, badCred: true }))
  faultLog.push(`provider bad credentials enum (DNP) -> other (error): ${id}`)
}
{
  const clinic = baseClinicOf('CA')
  const city = clinicCityMap[clinic.clinic_id as string]
  const id = fProvId()
  providers.push(buildProvider({ id, clinicId: clinic.clinic_id as string, city, badStatus: true }))
  faultLog.push(`provider bad license_status enum (Lapsed) -> other (error): ${id}`)
}

// (r) duplicate NPI alone (different name/license): 2 -> CARRIED (dedupe is name+state+license, NPI not checked)
{
  const clinic = baseClinicOf('TX')
  const city = clinicCityMap[clinic.clinic_id as string]
  const sharedNpi = '1903330001'
  for (let i = 0; i < 2; i++) {
    const id = fProvId()
    providers.push(buildProvider({ id, clinicId: clinic.clinic_id as string, city, npi: sharedNpi }))
    validProviderIds.push(id)
  }
  faultLog.push(`duplicate NPI (CARRIED, no detector): two providers share npi ${sharedNpi}`)
}

// (s) dirty phone format: 6 providers -> CARRIED (no validation)
for (let i = 0; i < 6; i++) {
  const state = ['FL', 'CA', 'TX', 'NY', 'FL', 'CA'][i]
  const clinic = baseClinicOf(state)
  const city = clinicCityMap[clinic.clinic_id as string]
  const id = fProvId()
  providers.push(buildProvider({ id, clinicId: clinic.clinic_id as string, city, dirtyPhone: true }))
  validProviderIds.push(id)
  faultLog.push(`dirty phone (CARRIED, no detector): ${id}`)
}

// (t) literal duplicate id rows (idempotency, NO alert): clinicId twice + providerId twice.
//     google_place_id cleared on the re-scrape rows so they don't self-trigger a
//     duplicate_clinic warning; this isolates the pure upsert-idempotency behaviour.
{
  const dupClinic = baseClinicOf('NY')
  clinics.push({ ...dupClinic, clinic_name: `${dupClinic.clinic_name} (re-scrape)`, google_place_id: '' })
  faultLog.push(`literal duplicate clinic_id ${dupClinic.clinic_id} (upsert -> updated, NO alert)`)
  const dupProv = providers.find((p) => p.clinic_id === dupClinic.clinic_id)!
  providers.push({ ...dupProv, tagline: 'Re-scraped row.' })
  faultLog.push(`literal duplicate provider_id ${dupProv.provider_id} (upsert -> updated, NO alert)`)
}

// (t2) deliberate slug collision: a NEW clinic whose name equals an existing base
//      clinic's name -> importer rejects with "invalid: slug" (other, error). No
//      providers/reviews attached so there is no cascade.
{
  const base = baseClinicOf('CA')
  const city = clinicCityMap[base.clinic_id as string]
  const id = fClinicId()
  clinics.push(buildClinic({ id, city, name: base.clinic_name as string, allowDupName: true }))
  faultLog.push(`duplicate clinic_name/slug "${base.clinic_name}" -> other (error, invalid slug): ${id}`)
}

// (u) review -> nonexistent clinic: 4 -> broken_relationship error (skipped)
for (let i = 0; i < 4; i++) {
  revSeq++
  reviews.push({
    review_id: `${revId()}`,
    provider_id: '', clinic_id: `clinic-ghost-${i}`,
    reviewer_first_name: pick(FIRST), reviewer_initial: 'X', reviewer_age_range: pick(AGE_RANGES), reviewer_city: 'Nowhere',
    rating: 5, review_title: pick(REVIEW_TITLES), review_text: reviewText(), treatment_tag: 'Botox',
    review_date: recentDate(300), source_platform: 'google', source_url: `https://google.example/ghost/${i}`,
    response_from_provider: '', response_date: '',
  })
  faultLog.push(`review -> missing clinic (error, skipped): ${revId()}`)
}

// (v) review -> nonexistent provider but valid clinic: 4 -> broken_relationship warning (clinic-only)
for (let i = 0; i < 4; i++) {
  const clinic = baseClinicOf(['CA', 'TX', 'NY', 'FL'][i])
  revSeq++
  reviews.push({
    review_id: `${revId()}`,
    provider_id: `prov-ghost-${i}`, clinic_id: clinic.clinic_id,
    reviewer_first_name: pick(FIRST), reviewer_initial: 'G', reviewer_age_range: pick(AGE_RANGES), reviewer_city: String(clinic.city),
    rating: 4, review_title: pick(REVIEW_TITLES), review_text: 'Clinic-level review naming a provider not in our DB.',
    treatment_tag: 'Botox', review_date: recentDate(300), source_platform: 'yelp', source_url: `https://yelp.example/g/${i}`,
    response_from_provider: '', response_date: '',
  })
  faultLog.push(`review -> missing provider, valid clinic (warning, clinic-only): ${revId()}`)
}

// (w) review bad source_platform enum: 3 -> other error (failed create)
for (let i = 0; i < 3; i++) {
  const clinic = baseClinicOf(['FL', 'CA', 'TX'][i])
  revSeq++
  reviews.push({
    review_id: `${revId()}`,
    provider_id: '', clinic_id: clinic.clinic_id,
    reviewer_first_name: pick(FIRST), reviewer_initial: 'I', reviewer_age_range: pick(AGE_RANGES), reviewer_city: String(clinic.city),
    rating: 5, review_title: pick(REVIEW_TITLES), review_text: 'Imported from a platform our schema does not allow.',
    treatment_tag: 'Lip Filler', review_date: recentDate(200), source_platform: 'instagram', source_url: `https://instagram.example/p/${i}`,
    response_from_provider: 'Thank you, glad you are happy, see you soon.', response_date: recentDate(180),
  })
  faultLog.push(`review bad source_platform enum (instagram) -> other (error): ${revId()}`)
}

// (x) one duplicate reviewId (idempotency, NO alert)
{
  const dup = reviews[0]
  reviews.push({ ...dup, review_title: 'Re-scraped review row.' })
  faultLog.push(`literal duplicate review_id ${dup.review_id} (upsert -> updated, NO alert)`)
}

// ----------------------------- 3) PHOTOS + QA (future-ready; NOT imported today) -----------------------------
const photoProviders = providers.filter((p) => validProviderIds.includes(p.provider_id as string)).slice(0, 80)
for (const p of photoProviders) {
  const clinicId = p.clinic_id as string
  // headshot
  photoSeq++
  photos.push({
    photo_id: `ph-${String(photoSeq).padStart(8, '0')}`, provider_id: p.provider_id, clinic_id: clinicId,
    treatment_tag: '', photo_url: p.profile_photo_url || `https://i.pravatar.cc/400?u=${p.provider_id}`,
    type: 'headshot', pair_id: '', weeks_post_treatment: '', caption: `${String(p.full_name)} headshot`,
    consent_documented: 'true', source_platform: 'clinic_site', source_url: SOURCE,
  })
  // before/after pair
  if (chance(0.6)) {
    const t = pick(String(p.treatments_offered).split('; '))
    const pairId = `pair-${String(photoSeq).padStart(5, '0')}`
    photoSeq++
    photos.push({ photo_id: `ph-${String(photoSeq).padStart(8, '0')}`, provider_id: p.provider_id, clinic_id: clinicId, treatment_tag: t, photo_url: `https://picsum.photos/seed/${p.provider_id}-before/400/500`, type: 'before', pair_id: pairId, weeks_post_treatment: '', caption: `${t} before`, consent_documented: chance(0.8) ? 'true' : 'false', source_platform: 'clinic_site', source_url: SOURCE })
    photoSeq++
    photos.push({ photo_id: `ph-${String(photoSeq).padStart(8, '0')}`, provider_id: p.provider_id, clinic_id: clinicId, treatment_tag: t, photo_url: `https://picsum.photos/seed/${p.provider_id}-after/400/500`, type: 'after', pair_id: pairId, weeks_post_treatment: randint(2, 12), caption: `${t}, ${randint(2, 12)} weeks post`, consent_documented: chance(0.8) ? 'true' : 'false', source_platform: 'clinic_site', source_url: SOURCE })
  }
}
// a few clinic interiors
for (const c of clinics.slice(0, 30)) {
  photoSeq++
  photos.push({ photo_id: `ph-${String(photoSeq).padStart(8, '0')}`, provider_id: '', clinic_id: c.clinic_id, treatment_tag: '', photo_url: `https://picsum.photos/seed/${c.clinic_id}-int/600/400`, type: 'clinic_interior', pair_id: '', weeks_post_treatment: '', caption: `${String(c.clinic_name)} interior`, consent_documented: 'true', source_platform: 'clinic_site', source_url: SOURCE })
}

// QA: ~50, mix of in-DB provider answers and name-only answers.
const qaProviders = providers.filter((p) => validProviderIds.includes(p.provider_id as string))
for (let i = 0; i < 50; i++) {
  qaSeq++
  const tmpl = pick(QA_TEMPLATES)
  const t = pick(VALID_TREATMENTS)
  const inDb = chance(0.6)
  const prov = inDb ? pick(qaProviders) : null
  const city = prov ? clinicCityMap[prov.clinic_id as string] : pick(CITIES[pick(['CA', 'TX', 'NY', 'FL'])])
  qa.push({
    qa_id: `qa-${String(qaSeq).padStart(8, '0')}`,
    question_title: tmpl.q.replace('{t}', t),
    question_text: `A patient asks: ${tmpl.q.replace('{t}', t).toLowerCase()}`,
    answered_by_provider_id: inDb && prov ? prov.provider_id : '',
    answered_by_name: !inDb ? `Dr. ${pick(FIRST)} ${pick(LAST)}` : '',
    answer_text: tmpl.a.replace(/\{t\}/g, t),
    treatment_tag: t,
    city_tag: city ? city.city : '',
    source_platform: pick(['clinic_blog', 'forum', 'directory']),
    source_url: `${SOURCE}/qa/${qaSeq}`,
    date: recentDate(500),
  })
}

// ----------------------------- write files -----------------------------
const outDir = path.resolve('data/fake')
fs.mkdirSync(outDir, { recursive: true })

const CLINIC_HEADERS = ['clinic_id', 'clinic_name', 'tagline', 'description', 'address_line_1', 'address_line_2', 'city', 'state', 'zip', 'neighborhood', 'county', 'country', 'latitude', 'longitude', 'google_place_id', 'google_maps_url', 'directions_url', 'apple_maps_url', 'phone', 'email', 'website_url', 'booking_url', 'hours_json', 'service_type', 'accepts_insurance', 'payment_methods', 'amenities', 'logo_url', 'clinic_photo_urls', 'aggregate_rating', 'aggregate_rating_count', 'provider_ids', 'year_established', 'source_urls', 'last_scraped_date']
const PROVIDER_HEADERS = ['provider_id', 'full_name', 'credentials', 'title', 'board_certifications', 'license_number', 'license_state', 'license_status', 'license_verification_url', 'npi_number', 'years_experience', 'year_started_practicing', 'clinic_id', 'tagline', 'bio', 'profile_photo_url', 'languages', 'gender', 'treatments_offered', 'specialties', 'services_offered', 'pricing_botox_per_unit', 'pricing_filler_per_syringe', 'pricing_consultation', 'accepts_new_patients', 'offers_virtual_consult', 'offers_in_person', 'website_url', 'email', 'phone_direct', 'instagram_url', 'tiktok_url', 'linkedin_url', 'aggregate_rating', 'aggregate_rating_count', 'source_urls', 'last_scraped_date']
const REVIEW_HEADERS = ['review_id', 'provider_id', 'clinic_id', 'reviewer_first_name', 'reviewer_initial', 'reviewer_age_range', 'reviewer_city', 'rating', 'review_title', 'review_text', 'treatment_tag', 'review_date', 'source_platform', 'source_url', 'response_from_provider', 'response_date']
const PHOTO_HEADERS = ['photo_id', 'provider_id', 'clinic_id', 'treatment_tag', 'photo_url', 'type', 'pair_id', 'weeks_post_treatment', 'caption', 'consent_documented', 'source_platform', 'source_url']
const QA_HEADERS = ['qa_id', 'question_title', 'question_text', 'answered_by_provider_id', 'answered_by_name', 'answer_text', 'treatment_tag', 'city_tag', 'source_platform', 'source_url', 'date']

fs.writeFileSync(path.join(outDir, 'clinics.csv'), toCsv(CLINIC_HEADERS, clinics))
fs.writeFileSync(path.join(outDir, 'providers.csv'), toCsv(PROVIDER_HEADERS, providers))
fs.writeFileSync(path.join(outDir, 'reviews.csv'), toCsv(REVIEW_HEADERS, reviews))
fs.writeFileSync(path.join(outDir, 'photos.csv'), toCsv(PHOTO_HEADERS, photos))
fs.writeFileSync(path.join(outDir, 'qa.csv'), toCsv(QA_HEADERS, qa))

console.log('===== fake data generated (data/fake/) =====')
console.log(`clinics.csv   : ${clinics.length} rows`)
console.log(`providers.csv : ${providers.length} rows`)
console.log(`reviews.csv   : ${reviews.length} rows`)
console.log(`photos.csv    : ${photos.length} rows  (future-ready, NOT imported today)`)
console.log(`qa.csv        : ${qa.length} rows  (future-ready, NOT imported today)`)
console.log(`\nCurated fault log (${faultLog.length} entries):`)
for (const f of faultLog) console.log('  - ' + f)
