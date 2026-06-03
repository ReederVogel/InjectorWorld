/**
 * Mock data for injector.world.
 *
 * Field shapes match data/scraper-brief.md so real scraped CSVs slot in later.
 * Names, license numbers, and reviewer identities are fictional.
 * Lat/lng coordinates are real so PostGIS queries return realistic results.
 */

// ===== TREATMENTS =====
export const treatments = [
  {
    name: 'Botox',
    slug: 'botox',
    category: 'neurotoxin',
    tagline: 'The most common aesthetic treatment in the US.',
    shortDescription: 'Temporarily softens forehead lines, glabella (the 11s), and crow\'s feet.',
    bodyAreas: ['forehead', 'brow', 'crows-feet'],
    avgPriceFromUsd: 280, avgPriceToUsd: 720, priceUnit: 'per_session', iconSlug: 'syringe',
  },
  {
    name: 'Dysport', slug: 'dysport', category: 'neurotoxin',
    tagline: 'A faster-acting alternative to Botox.',
    shortDescription: 'Same family as Botox, may kick in slightly sooner. Used for upper-face lines.',
    bodyAreas: ['forehead', 'brow', 'crows-feet'],
    avgPriceFromUsd: 240, avgPriceToUsd: 680, priceUnit: 'per_session', iconSlug: 'syringe',
  },
  {
    name: 'Lip Filler', slug: 'lip-filler', category: 'filler',
    tagline: 'Subtle volume, hydration, a softer cupid\'s bow.',
    shortDescription: 'Hyaluronic acid gels add structure or hydration to the lips. Reversible.',
    bodyAreas: ['lips'],
    avgPriceFromUsd: 600, avgPriceToUsd: 1100, priceUnit: 'per_syringe', iconSlug: 'lips',
  },
  {
    name: 'Cheek Filler', slug: 'cheek-filler', category: 'filler',
    tagline: 'Lift the mid-face. Restore a youthful contour.',
    shortDescription: 'HA filler placed deep on the cheekbone to restore volume and lift skin.',
    bodyAreas: ['cheeks'],
    avgPriceFromUsd: 800, avgPriceToUsd: 1600, priceUnit: 'per_session', iconSlug: 'face',
  },
  {
    name: 'Jawline Filler', slug: 'jawline-filler', category: 'filler',
    tagline: 'Contour the jaw and sharpen the angle.',
    shortDescription: 'HA filler placed along the mandible for definition and projection.',
    bodyAreas: ['jawline', 'chin'],
    avgPriceFromUsd: 900, avgPriceToUsd: 1800, priceUnit: 'per_session', iconSlug: 'jawline',
  },
  {
    name: 'Tear Trough Filler', slug: 'tear-trough', category: 'filler',
    tagline: 'For under-eye shadows and hollows.',
    shortDescription: 'Specialized HA filler placed beneath the eye to soften dark circles.',
    bodyAreas: ['under-eye'],
    avgPriceFromUsd: 750, avgPriceToUsd: 1500, priceUnit: 'per_session', iconSlug: 'eye',
  },
  {
    name: 'Masseter Botox', slug: 'masseter-botox', category: 'neurotoxin',
    tagline: 'Jaw slimming and TMJ relief.',
    shortDescription: 'Botox in the masseter muscle reduces jaw width and clenching.',
    bodyAreas: ['jawline'],
    avgPriceFromUsd: 500, avgPriceToUsd: 900, priceUnit: 'per_session', iconSlug: 'jaw',
  },
  {
    name: 'Kybella', slug: 'kybella', category: 'other',
    tagline: 'Dissolves submental fat under the chin.',
    shortDescription: 'Deoxycholic acid injection that permanently destroys fat cells.',
    bodyAreas: ['chin', 'neck'],
    avgPriceFromUsd: 1200, avgPriceToUsd: 2400, priceUnit: 'per_session', iconSlug: 'chin',
  },
  {
    name: 'Sculptra', slug: 'sculptra', category: 'biostimulator',
    tagline: 'Builds your own collagen over months.',
    shortDescription: 'Poly-L-lactic acid stimulates collagen production. Effects build gradually.',
    bodyAreas: ['cheeks', 'jawline', 'decolletage'],
    avgPriceFromUsd: 800, avgPriceToUsd: 1600, priceUnit: 'per_session', iconSlug: 'collagen',
  },
  {
    name: 'PRP Therapy', slug: 'prp', category: 'skin',
    tagline: 'Your own blood, repurposed for skin.',
    shortDescription: 'Platelet-rich plasma drawn from you, injected for skin and hair rejuvenation.',
    bodyAreas: ['cheeks', 'under-eye', 'decolletage'],
    avgPriceFromUsd: 600, avgPriceToUsd: 1200, priceUnit: 'per_session', iconSlug: 'drop',
  },
  {
    name: 'Microneedling', slug: 'microneedling', category: 'skin',
    tagline: 'Triggers skin repair through controlled micro-injury.',
    shortDescription: 'Fine needles puncture skin to stimulate collagen and improve texture.',
    bodyAreas: ['cheeks', 'forehead', 'neck', 'decolletage'],
    avgPriceFromUsd: 300, avgPriceToUsd: 900, priceUnit: 'per_session', iconSlug: 'dots',
  },
  {
    name: 'Thread Lift', slug: 'thread-lift', category: 'thread',
    tagline: 'Dissolvable threads lift sagging tissue.',
    shortDescription: 'PDO or PLLA threads inserted under the skin to subtly lift the face.',
    bodyAreas: ['cheeks', 'jawline', 'brow'],
    avgPriceFromUsd: 1500, avgPriceToUsd: 4000, priceUnit: 'per_session', iconSlug: 'thread',
  },
] as const

// ===== AUTHORS =====
export const authors = [
  {
    fullName: 'Hannah Reyes', slug: 'hannah-reyes', role: 'Senior Editor',
    bio: 'Hannah covers aesthetic medicine and has reported on the injectables industry for 6 years. Her work has appeared in The Cut, Refinery29, and Self.',
    photoUrl: 'https://i.pravatar.cc/160?img=38',
    linkedinUrl: 'https://linkedin.com/in/hannah-reyes', articleCount: 12,
  },
  {
    fullName: 'Maya Iyer', slug: 'maya-iyer', role: 'Staff Writer',
    bio: 'Maya writes about cost, safety, and consumer protection in elective medicine. Former healthcare reporter at ProPublica.',
    photoUrl: 'https://i.pravatar.cc/160?img=44', articleCount: 7,
  },
  {
    fullName: 'Devin Rao', slug: 'devin-rao', role: 'Editor at Large',
    bio: 'Devin profiles practitioners and clinics. Twelve years covering beauty for national publications.',
    photoUrl: 'https://i.pravatar.cc/160?img=53', articleCount: 18,
  },
]

// ===== MEDICAL REVIEWERS =====
export const medicalReviewers = [
  {
    fullName: 'Dr. Lena Park, MD', slug: 'lena-park-md', credentials: 'MD',
    title: 'Board-Certified Dermatologist',
    city: 'New York', state: 'NY',
    bio: 'Fourteen years of clinical practice in dermatology. Fellow of the American Academy of Dermatology. Reviews all neurotoxin content for injector.world.',
    photoUrl: 'https://i.pravatar.cc/160?img=47',
    npiNumber: '1234567890',
    boardCertifications: [{ name: 'Dermatology, ABD' }, { name: 'AAD Fellow' }],
    reviewedCount: 24,
  },
  {
    fullName: 'Dr. Marcus Hill, MD', slug: 'marcus-hill-md', credentials: 'MD',
    title: 'Board-Certified Plastic Surgeon',
    city: 'Beverly Hills', state: 'CA',
    bio: 'Plastic surgeon with 18 years of practice. Reviewer for the journal Aesthetic Surgery.',
    photoUrl: 'https://i.pravatar.cc/160?img=12',
    boardCertifications: [{ name: 'Plastic Surgery, ABPS' }],
    reviewedCount: 16,
  },
  {
    fullName: 'Dr. Aisha Bello, MD', slug: 'aisha-bello-md', credentials: 'MD',
    title: 'Board-Certified Facial Plastic Surgeon',
    city: 'Atlanta', state: 'GA',
    bio: 'Facial plastic surgeon. Trained at Johns Hopkins. Focus on injectable techniques and patient consent.',
    photoUrl: 'https://i.pravatar.cc/160?img=49',
    boardCertifications: [{ name: 'Facial Plastic Surgery, ABFPRS' }],
    reviewedCount: 11,
  },
  {
    fullName: 'Dr. James Whitaker, DO', slug: 'james-whitaker-do', credentials: 'DO',
    title: 'Board-Certified Aesthetic Medicine',
    city: 'Chicago', state: 'IL',
    bio: 'Aesthetic medicine specialist. Practices and teaches across the Midwest.',
    photoUrl: 'https://i.pravatar.cc/160?img=14',
    boardCertifications: [{ name: 'Aesthetic Medicine, AAAM' }],
    reviewedCount: 9,
  },
  {
    fullName: 'Dr. Priya Shah, MD', slug: 'priya-shah-md', credentials: 'MD',
    title: 'Board-Certified Dermatologist',
    city: 'San Francisco', state: 'CA',
    bio: 'Dermatologist specializing in skin of color and laser medicine.',
    photoUrl: 'https://i.pravatar.cc/160?img=45',
    boardCertifications: [{ name: 'Dermatology, ABD' }],
    reviewedCount: 8,
  },
]

// ===== STATES (50) =====
const stateRows: Array<[string, string]> = [
  ['Alabama','AL'],['Alaska','AK'],['Arizona','AZ'],['Arkansas','AR'],['California','CA'],
  ['Colorado','CO'],['Connecticut','CT'],['Delaware','DE'],['Florida','FL'],['Georgia','GA'],
  ['Hawaii','HI'],['Idaho','ID'],['Illinois','IL'],['Indiana','IN'],['Iowa','IA'],
  ['Kansas','KS'],['Kentucky','KY'],['Louisiana','LA'],['Maine','ME'],['Maryland','MD'],
  ['Massachusetts','MA'],['Michigan','MI'],['Minnesota','MN'],['Mississippi','MS'],['Missouri','MO'],
  ['Montana','MT'],['Nebraska','NE'],['Nevada','NV'],['New Hampshire','NH'],['New Jersey','NJ'],
  ['New Mexico','NM'],['New York','NY'],['North Carolina','NC'],['North Dakota','ND'],['Ohio','OH'],
  ['Oklahoma','OK'],['Oregon','OR'],['Pennsylvania','PA'],['Rhode Island','RI'],['South Carolina','SC'],
  ['South Dakota','SD'],['Tennessee','TN'],['Texas','TX'],['Utah','UT'],['Vermont','VT'],
  ['Virginia','VA'],['Washington','WA'],['West Virginia','WV'],['Wisconsin','WI'],['Wyoming','WY'],
]
const featuredStateCodes = new Set(['NY','CA','FL','IL','TX','GA','AZ','WA','MA','DC','CO','NV'])
export const states = stateRows.map(([name, code], i) => ({
  name, slug: name.toLowerCase().replace(/\s+/g, '-'), kind: 'state', state: code,
  sortRank: featuredStateCodes.has(code) ? i + 1 : 100 + i,
  featured: featuredStateCodes.has(code), providerCount: Math.floor(Math.random() * 1200) + 50,
}))

// ===== METROS (top 20) =====
type MetroRow = { name: string; state: string; lat: number; lng: number; providerCount: number; image: string }
const metroRows: MetroRow[] = [
  { name: 'New York City', state: 'NY', lat: 40.7128, lng: -74.0060, providerCount: 1240, image: 'https://picsum.photos/seed/nyc-skyline/600/480' },
  { name: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437, providerCount: 1080, image: 'https://picsum.photos/seed/la-palms/600/480' },
  { name: 'Miami', state: 'FL', lat: 25.7617, lng: -80.1918, providerCount: 820, image: 'https://picsum.photos/seed/miami-brickell/600/480' },
  { name: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298, providerCount: 640, image: 'https://picsum.photos/seed/chicago-river/600/480' },
  { name: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698, providerCount: 590, image: 'https://picsum.photos/seed/houston-tx/600/480' },
  { name: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970, providerCount: 560, image: 'https://picsum.photos/seed/dallas-skyline/600/480' },
  { name: 'Atlanta', state: 'GA', lat: 33.7490, lng: -84.3880, providerCount: 510, image: 'https://picsum.photos/seed/atlanta-ga/600/480' },
  { name: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740, providerCount: 460, image: 'https://picsum.photos/seed/phoenix-az/600/480' },
  { name: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321, providerCount: 430, image: 'https://picsum.photos/seed/seattle-wa/600/480' },
  { name: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589, providerCount: 410, image: 'https://picsum.photos/seed/boston-ma/600/480' },
  { name: 'Washington DC', state: 'DC', lat: 38.9072, lng: -77.0369, providerCount: 390, image: 'https://picsum.photos/seed/dc-monument/600/480' },
  { name: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194, providerCount: 380, image: 'https://picsum.photos/seed/sf-bay/600/480' },
  { name: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903, providerCount: 350, image: 'https://picsum.photos/seed/denver-co/600/480' },
  { name: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431, providerCount: 340, image: 'https://picsum.photos/seed/austin-tx/600/480' },
  { name: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611, providerCount: 330, image: 'https://picsum.photos/seed/sd-pier/600/480' },
  { name: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652, providerCount: 310, image: 'https://picsum.photos/seed/philly-pa/600/480' },
  { name: 'Nashville', state: 'TN', lat: 36.1627, lng: -86.7816, providerCount: 290, image: 'https://picsum.photos/seed/nashville-tn/600/480' },
  { name: 'Charlotte', state: 'NC', lat: 35.2271, lng: -80.8431, providerCount: 270, image: 'https://picsum.photos/seed/charlotte-nc/600/480' },
  { name: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398, providerCount: 250, image: 'https://picsum.photos/seed/vegas-strip/600/480' },
  { name: 'Portland', state: 'OR', lat: 45.5152, lng: -122.6784, providerCount: 220, image: 'https://picsum.photos/seed/portland-or/600/480' },
]
const METRO_SLUG: Record<string, string> = {
  'New York City': 'new-york-ny',
  'Los Angeles': 'los-angeles-ca',
  'Miami': 'miami-fl',
  'Chicago': 'chicago-il',
  'Houston': 'houston-tx',
  'Dallas': 'dallas-tx',
  'Atlanta': 'atlanta-ga',
  'Phoenix': 'phoenix-az',
  'Seattle': 'seattle-wa',
  'Boston': 'boston-ma',
  'Washington DC': 'washington-dc',
  'San Francisco': 'san-francisco-ca',
  'Denver': 'denver-co',
  'Austin': 'austin-tx',
  'San Diego': 'san-diego-ca',
  'Philadelphia': 'philadelphia-pa',
  'Nashville': 'nashville-tn',
  'Charlotte': 'charlotte-nc',
  'Las Vegas': 'las-vegas-nv',
  'Portland': 'portland-or',
}

export const metros = metroRows.map((m, i) => ({
  name: m.name,
  slug: METRO_SLUG[m.name] ?? slugify(`${m.name}-${m.state}`),
  kind: 'metro', state: m.state,
  latitude: m.lat, longitude: m.lng, imageUrl: m.image,
  providerCount: m.providerCount, sortRank: i + 1, featured: true,
}))

// ===== NYC NEIGHBORHOODS =====
const nycNeighborhoodRows: Array<[string, number, number, number]> = [
  ['Upper East Side', 40.7736, -73.9566, 180],
  ['Tribeca', 40.7163, -74.0086, 94],
  ['SoHo', 40.7233, -74.0030, 76],
  ['West Village', 40.7339, -74.0011, 88],
  ['Williamsburg', 40.7081, -73.9571, 112],
  ['Midtown', 40.7549, -73.9840, 140],
  ['Park Slope', 40.6710, -73.9814, 62],
  ['Astoria', 40.7720, -73.9301, 54],
  ['Long Island City', 40.7447, -73.9485, 38],
  ['Upper West Side', 40.7870, -73.9754, 96],
  ['Chelsea', 40.7465, -74.0014, 78],
  ['Flatiron', 40.7401, -73.9903, 64],
]
export const nycNeighborhoods = nycNeighborhoodRows.map(([name, lat, lng, count], i) => ({
  name, slug: slugify(name as string), kind: 'neighborhood', state: 'NY',
  latitude: lat as number, longitude: lng as number, providerCount: count as number, sortRank: i + 1,
}))

// ===== CLINICS (8) =====
export const clinics = [
  {
    clinicId: 'clinic-nyc-00001', clinicName: 'Park Avenue Dermatology',
    slug: 'park-avenue-dermatology', tagline: 'Upper East Side\'s most reviewed dermatology practice.',
    description: 'A 12-year Upper East Side practice specializing in conservative, natural neurotoxin and filler results. Five providers, three treatment rooms, in-house pharmacy.',
    addressLine1: '1000 Park Avenue', addressLine2: 'Suite 3B',
    city: 'New York', state: 'NY', zip: '10028', neighborhood: 'Upper East Side', country: 'US',
    latitude: 40.7736, longitude: -73.9566,
    googlePlaceId: 'mock-place-id-park-ave-derm',
    googleMapsUrl: 'https://maps.google.com/?q=Park+Avenue+Dermatology',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=40.7736,-73.9566',
    phone: '+12125550100', email: 'hello@parkavederm.example', websiteUrl: 'https://parkavederm.example',
    bookingUrl: 'https://parkavederm.example/book',
    serviceType: 'In-Person',
    logoUrl: 'https://picsum.photos/seed/clinic-1-logo/200/200',
    clinicPhotoUrls: [{ url: 'https://picsum.photos/seed/clinic-1/600/400' }, { url: 'https://picsum.photos/seed/clinic-1b/600/400' }],
    aggregateRating: 4.9, aggregateRatingCount: 412, yearEstablished: 2012,
    sourceUrls: [{ url: 'https://injector.world/seed' }], lastScrapedDate: new Date('2026-05-30').toISOString(),
  },
  {
    clinicId: 'clinic-nyc-00002', clinicName: 'Tribeca Aesthetic Group',
    slug: 'tribeca-aesthetic-group', tagline: 'Lower Manhattan\'s editorial-grade injectables practice.',
    addressLine1: '85 Hudson Street', city: 'New York', state: 'NY', zip: '10013',
    neighborhood: 'Tribeca', country: 'US',
    latitude: 40.7163, longitude: -74.0086,
    googlePlaceId: 'mock-place-id-tribeca-aesthetic',
    googleMapsUrl: 'https://maps.google.com/?q=Tribeca+Aesthetic+Group',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=40.7163,-74.0086',
    phone: '+12125550200', websiteUrl: 'https://tribecaaesthetic.example',
    serviceType: 'In-Person',
    clinicPhotoUrls: [{ url: 'https://picsum.photos/seed/clinic-2/600/400' }],
    aggregateRating: 5.0, aggregateRatingCount: 267, yearEstablished: 2015,
    sourceUrls: [{ url: 'https://injector.world/seed' }], lastScrapedDate: new Date('2026-05-30').toISOString(),
  },
  {
    clinicId: 'clinic-nyc-00003', clinicName: 'West Village Skin',
    slug: 'west-village-skin', tagline: 'Nurse-led aesthetic practice in the West Village.',
    addressLine1: '210 West 10th Street', city: 'New York', state: 'NY', zip: '10014',
    neighborhood: 'West Village', country: 'US',
    latitude: 40.7339, longitude: -74.0011,
    googlePlaceId: 'mock-place-id-west-village-skin',
    googleMapsUrl: 'https://maps.google.com/?q=West+Village+Skin',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=40.7339,-74.0011',
    phone: '+12125550300', websiteUrl: 'https://wvskin.example',
    serviceType: 'In-Person',
    clinicPhotoUrls: [{ url: 'https://picsum.photos/seed/clinic-3/600/400' }],
    aggregateRating: 4.8, aggregateRatingCount: 498, yearEstablished: 2018,
    sourceUrls: [{ url: 'https://injector.world/seed' }], lastScrapedDate: new Date('2026-05-30').toISOString(),
  },
  {
    clinicId: 'clinic-nyc-00004', clinicName: 'Williamsburg Aesthetics',
    slug: 'williamsburg-aesthetics', tagline: 'Brooklyn-based aesthetic medicine.',
    addressLine1: '350 Bedford Avenue', city: 'New York', state: 'NY', zip: '11211',
    neighborhood: 'Williamsburg', country: 'US',
    latitude: 40.7081, longitude: -73.9571,
    googlePlaceId: 'mock-place-id-williamsburg-aesthetics',
    googleMapsUrl: 'https://maps.google.com/?q=Williamsburg+Aesthetics',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=40.7081,-73.9571',
    phone: '+17185550400', websiteUrl: 'https://williamsburg-aesthetics.example',
    serviceType: 'In-Person',
    clinicPhotoUrls: [{ url: 'https://picsum.photos/seed/clinic-4/600/400' }],
    aggregateRating: 4.9, aggregateRatingCount: 445, yearEstablished: 2020,
    sourceUrls: [{ url: 'https://injector.world/seed' }], lastScrapedDate: new Date('2026-05-30').toISOString(),
  },
  {
    clinicId: 'clinic-la-00001', clinicName: 'Rodeo Drive Dermatology',
    slug: 'rodeo-drive-dermatology', tagline: 'Beverly Hills dermatology with a 20-year track record.',
    addressLine1: '450 N Rodeo Drive', city: 'Beverly Hills', state: 'CA', zip: '90210',
    neighborhood: 'Beverly Hills', country: 'US',
    latitude: 34.0736, longitude: -118.4004,
    googlePlaceId: 'mock-place-id-rodeo-derm',
    googleMapsUrl: 'https://maps.google.com/?q=Rodeo+Drive+Dermatology',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=34.0736,-118.4004',
    phone: '+13105550500', websiteUrl: 'https://rodeoderm.example',
    serviceType: 'In-Person',
    clinicPhotoUrls: [{ url: 'https://picsum.photos/seed/clinic-5/600/400' }],
    aggregateRating: 4.9, aggregateRatingCount: 388, yearEstablished: 2005,
    sourceUrls: [{ url: 'https://injector.world/seed' }], lastScrapedDate: new Date('2026-05-30').toISOString(),
  },
  {
    clinicId: 'clinic-mia-00001', clinicName: 'Brickell Aesthetic Medicine',
    slug: 'brickell-aesthetic-medicine', tagline: 'Modern aesthetic medicine in the heart of Brickell.',
    addressLine1: '1450 Brickell Avenue', city: 'Miami', state: 'FL', zip: '33131',
    neighborhood: 'Brickell', country: 'US',
    latitude: 25.7616, longitude: -80.1918,
    googlePlaceId: 'mock-place-id-brickell',
    googleMapsUrl: 'https://maps.google.com/?q=Brickell+Aesthetic+Medicine',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=25.7616,-80.1918',
    phone: '+13055550600', websiteUrl: 'https://brickellaesthetic.example',
    serviceType: 'In-Person',
    clinicPhotoUrls: [{ url: 'https://picsum.photos/seed/clinic-6/600/400' }],
    aggregateRating: 4.8, aggregateRatingCount: 510, yearEstablished: 2017,
    sourceUrls: [{ url: 'https://injector.world/seed' }], lastScrapedDate: new Date('2026-05-30').toISOString(),
  },
  {
    clinicId: 'clinic-chi-00001', clinicName: 'River North Skin',
    slug: 'river-north-skin', tagline: 'Chicago-based aesthetic medicine practice.',
    addressLine1: '450 N Wells Street', city: 'Chicago', state: 'IL', zip: '60654',
    neighborhood: 'River North', country: 'US',
    latitude: 41.8924, longitude: -87.6346,
    googlePlaceId: 'mock-place-id-river-north',
    googleMapsUrl: 'https://maps.google.com/?q=River+North+Skin',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=41.8924,-87.6346',
    phone: '+13125550700', websiteUrl: 'https://rivernorthskin.example',
    serviceType: 'In-Person',
    clinicPhotoUrls: [{ url: 'https://picsum.photos/seed/clinic-7/600/400' }],
    aggregateRating: 4.8, aggregateRatingCount: 332, yearEstablished: 2014,
    sourceUrls: [{ url: 'https://injector.world/seed' }], lastScrapedDate: new Date('2026-05-30').toISOString(),
  },
  {
    clinicId: 'clinic-sf-00001', clinicName: 'Pacific Heights Dermatology',
    slug: 'pacific-heights-dermatology', tagline: 'Boutique dermatology in Pacific Heights.',
    addressLine1: '2200 Webster Street', city: 'San Francisco', state: 'CA', zip: '94115',
    neighborhood: 'Pacific Heights', country: 'US',
    latitude: 37.7929, longitude: -122.4344,
    googlePlaceId: 'mock-place-id-pac-heights',
    googleMapsUrl: 'https://maps.google.com/?q=Pacific+Heights+Dermatology',
    directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=37.7929,-122.4344',
    phone: '+14155550800', websiteUrl: 'https://pacheightsderm.example',
    serviceType: 'In-Person',
    clinicPhotoUrls: [{ url: 'https://picsum.photos/seed/clinic-8/600/400' }],
    aggregateRating: 4.9, aggregateRatingCount: 275, yearEstablished: 2010,
    sourceUrls: [{ url: 'https://injector.world/seed' }], lastScrapedDate: new Date('2026-05-30').toISOString(),
  },
]

// ===== PROVIDERS (15) =====
type ProviderSeed = {
  providerId: string; fullName: string; slug: string;
  credentials: 'MD'|'DO'|'NP'|'PA'|'RN'|'DDS'; title: string;
  boardCertifications?: Array<{ name: string }>;
  licenseNumber: string; licenseState: string; licenseStatus: 'Active';
  licenseVerificationUrl: string; npiNumber?: string;
  yearsExperience: number; yearStartedPracticing: number;
  clinicRefId: string; tagline: string; bio: string;
  profilePhotoUrl: string;
  languages?: string[]; gender?: 'Female'|'Male'|'Non-binary'|'Unknown';
  treatmentSlugs: string[];
  specialties?: Array<{ name: string }>;
  pricingBotoxPerUnit?: number; pricingFillerPerSyringe?: number; pricingConsultation?: number;
  startingPrice?: number;
  acceptsNewPatients: boolean; offersVirtualConsult: boolean; offersInPerson: boolean;
  websiteUrl?: string; instagramUrl?: string;
  aggregateRating: number; aggregateRatingCount: number;
  editorsPick?: boolean; featuredRank?: number;
  sourceUrls?: Array<{ url: string }>; lastScrapedDate?: string;
}

export const providers: ProviderSeed[] = [
  // Park Avenue Dermatology (NYC, Upper East Side)
  {
    providerId: 'prov-nyc-00001', fullName: 'Dr. Lena Park, MD', slug: 'lena-park-md-nyc',
    credentials: 'MD', title: 'Board-Certified Dermatologist',
    boardCertifications: [{ name: 'Dermatology, ABD' }, { name: 'AAD Fellow' }],
    licenseNumber: '271832', licenseState: 'NY', licenseStatus: 'Active',
    licenseVerificationUrl: 'https://op.nysed.gov/verification-search', npiNumber: '1234567890',
    yearsExperience: 14, yearStartedPracticing: 2012,
    clinicRefId: 'clinic-nyc-00001',
    tagline: 'Conservative, natural Botox on the Upper East Side.',
    bio: 'Dr. Park completed dermatology residency at NYU. She has 14 years of full-time practice with a focus on neurotoxins and tear-trough filler.',
    profilePhotoUrl: 'https://i.pravatar.cc/200?img=47',
    languages: ['English', 'Korean'], gender: 'Female',
    treatmentSlugs: ['botox', 'lip-filler', 'tear-trough', 'cheek-filler'],
    specialties: [{ name: 'Forehead' }, { name: 'Tear Trough' }, { name: 'Cheek volume' }],
    pricingBotoxPerUnit: 17, pricingConsultation: 100, startingPrice: 520,
    acceptsNewPatients: true, offersVirtualConsult: true, offersInPerson: true,
    aggregateRating: 4.9, aggregateRatingCount: 412,
    editorsPick: true, featuredRank: 1,
    sourceUrls: [{ url: 'https://injector.world/seed' }], lastScrapedDate: new Date('2026-05-30').toISOString(),
  },
  {
    providerId: 'prov-nyc-00002', fullName: 'Dr. Daniel Cho, MD', slug: 'daniel-cho-md-nyc',
    credentials: 'MD', title: 'Board-Certified Facial Plastic Surgeon',
    boardCertifications: [{ name: 'Facial Plastic Surgery, ABFPRS' }],
    licenseNumber: '294120', licenseState: 'NY', licenseStatus: 'Active',
    licenseVerificationUrl: 'https://op.nysed.gov/verification-search',
    yearsExperience: 11, yearStartedPracticing: 2015, clinicRefId: 'clinic-nyc-00001',
    tagline: 'Facial plastic surgeon focused on the lower face.',
    bio: 'Dr. Cho trained at Stanford and now practices in NYC. Subspecialty interest in jawline contouring and masseter botox.',
    profilePhotoUrl: 'https://i.pravatar.cc/200?img=33',
    languages: ['English', 'Mandarin'], gender: 'Male',
    treatmentSlugs: ['botox', 'cheek-filler', 'jawline-filler', 'masseter-botox'],
    specialties: [{ name: 'Jawline' }, { name: 'Masseter' }],
    pricingBotoxPerUnit: 18, startingPrice: 620,
    acceptsNewPatients: true, offersVirtualConsult: false, offersInPerson: true,
    aggregateRating: 4.9, aggregateRatingCount: 376,
    editorsPick: true, featuredRank: 2,
    sourceUrls: [{ url: 'https://injector.world/seed' }],
  },
  {
    providerId: 'prov-nyc-00003', fullName: 'Sofia Reyes, NP', slug: 'sofia-reyes-np-nyc',
    credentials: 'NP', title: 'Aesthetic Nurse Practitioner',
    licenseNumber: 'APRN18229', licenseState: 'NY', licenseStatus: 'Active',
    licenseVerificationUrl: 'https://op.nysed.gov/verification-search',
    yearsExperience: 8, yearStartedPracticing: 2018, clinicRefId: 'clinic-nyc-00001',
    tagline: 'Steady-handed nurse injector.',
    bio: 'Sofia has trained with three NYC dermatologists over 8 years. Conservative philosophy, transparent pricing.',
    profilePhotoUrl: 'https://i.pravatar.cc/200?img=24',
    languages: ['English', 'Spanish'], gender: 'Female',
    treatmentSlugs: ['botox', 'lip-filler', 'masseter-botox'],
    pricingBotoxPerUnit: 14, startingPrice: 440,
    acceptsNewPatients: true, offersVirtualConsult: true, offersInPerson: true,
    aggregateRating: 4.8, aggregateRatingCount: 498,
    sourceUrls: [{ url: 'https://injector.world/seed' }],
  },

  // Tribeca Aesthetic Group (NYC, Tribeca)
  {
    providerId: 'prov-nyc-00004', fullName: 'Dr. Rachel Goldman, MD', slug: 'rachel-goldman-md-nyc',
    credentials: 'MD', title: 'Board-Certified Dermatologist',
    boardCertifications: [{ name: 'Dermatology, ABD' }],
    licenseNumber: '261905', licenseState: 'NY', licenseStatus: 'Active',
    licenseVerificationUrl: 'https://op.nysed.gov/verification-search',
    yearsExperience: 16, yearStartedPracticing: 2010, clinicRefId: 'clinic-nyc-00002',
    tagline: 'Honest, conservative, no upsell.',
    bio: 'Sixteen years of practice. Known among colleagues for her conservative approach.',
    profilePhotoUrl: 'https://i.pravatar.cc/200?img=45',
    languages: ['English'], gender: 'Female',
    treatmentSlugs: ['botox', 'tear-trough', 'prp'],
    pricingBotoxPerUnit: 18, startingPrice: 560,
    acceptsNewPatients: true, offersVirtualConsult: false, offersInPerson: true,
    aggregateRating: 5.0, aggregateRatingCount: 267,
    editorsPick: true, featuredRank: 4,
    sourceUrls: [{ url: 'https://injector.world/seed' }],
  },
  {
    providerId: 'prov-nyc-00005', fullName: 'Dr. Omar Haddad, MD', slug: 'omar-haddad-md-nyc',
    credentials: 'MD', title: 'Board-Certified Plastic Surgeon',
    boardCertifications: [{ name: 'Plastic Surgery, ABPS' }],
    licenseNumber: '283114', licenseState: 'NY', licenseStatus: 'Active',
    licenseVerificationUrl: 'https://op.nysed.gov/verification-search',
    yearsExperience: 12, yearStartedPracticing: 2014, clinicRefId: 'clinic-nyc-00002',
    tagline: 'Plastic surgeon with a careful injectables practice.',
    bio: 'Plastic surgeon who maps every face before any injection. Subspecialty interest in biostimulators.',
    profilePhotoUrl: 'https://i.pravatar.cc/200?img=17',
    languages: ['English', 'Arabic'], gender: 'Male',
    treatmentSlugs: ['botox', 'sculptra', 'cheek-filler', 'jawline-filler'],
    pricingBotoxPerUnit: 17, startingPrice: 580,
    acceptsNewPatients: true, offersVirtualConsult: false, offersInPerson: true,
    aggregateRating: 4.8, aggregateRatingCount: 321,
    sourceUrls: [{ url: 'https://injector.world/seed' }],
  },

  // West Village Skin (NYC, West Village)
  {
    providerId: 'prov-nyc-00006', fullName: 'Maya Singh, NP', slug: 'maya-singh-np-nyc',
    credentials: 'NP', title: 'Aesthetic Nurse Practitioner',
    licenseNumber: 'APRN17321', licenseState: 'NY', licenseStatus: 'Active',
    licenseVerificationUrl: 'https://op.nysed.gov/verification-search',
    yearsExperience: 7, yearStartedPracticing: 2019, clinicRefId: 'clinic-nyc-00003',
    tagline: 'TMJ-focused masseter injector.',
    bio: 'Maya has followed her supervising dermatologist for 7 years. Specialty in masseter botox for both jaw slimming and TMJ relief.',
    profilePhotoUrl: 'https://i.pravatar.cc/200?img=29',
    languages: ['English', 'Hindi'], gender: 'Female',
    treatmentSlugs: ['botox', 'masseter-botox', 'lip-filler'],
    pricingBotoxPerUnit: 14, startingPrice: 440,
    acceptsNewPatients: true, offersVirtualConsult: true, offersInPerson: true,
    aggregateRating: 4.9, aggregateRatingCount: 445,
    sourceUrls: [{ url: 'https://injector.world/seed' }],
  },
  {
    providerId: 'prov-nyc-00007', fullName: 'Jenna Wu, PA', slug: 'jenna-wu-pa-nyc',
    credentials: 'PA', title: 'Physician Assistant, Aesthetic Medicine',
    licenseNumber: 'PA32890', licenseState: 'NY', licenseStatus: 'Active',
    licenseVerificationUrl: 'https://op.nysed.gov/verification-search',
    yearsExperience: 8, yearStartedPracticing: 2018, clinicRefId: 'clinic-nyc-00003',
    tagline: 'Friendly without being chatty.',
    bio: 'Eight years in aesthetic medicine, primarily injectables and microneedling.',
    profilePhotoUrl: 'https://i.pravatar.cc/200?img=20',
    languages: ['English', 'Mandarin'], gender: 'Female',
    treatmentSlugs: ['botox', 'lip-filler', 'microneedling'],
    pricingBotoxPerUnit: 12, startingPrice: 400,
    acceptsNewPatients: true, offersVirtualConsult: true, offersInPerson: true,
    aggregateRating: 4.9, aggregateRatingCount: 445,
    sourceUrls: [{ url: 'https://injector.world/seed' }],
  },

  // Williamsburg Aesthetics (Brooklyn)
  {
    providerId: 'prov-nyc-00008', fullName: 'Dr. Elena Mosconi, MD', slug: 'elena-mosconi-md-nyc',
    credentials: 'MD', title: 'Board-Certified Dermatologist',
    boardCertifications: [{ name: 'Dermatology, ABD' }],
    licenseNumber: '278455', licenseState: 'NY', licenseStatus: 'Active',
    licenseVerificationUrl: 'https://op.nysed.gov/verification-search',
    yearsExperience: 10, yearStartedPracticing: 2016, clinicRefId: 'clinic-nyc-00004',
    tagline: 'Brooklyn-based, conservative aesthetics.',
    bio: 'Dermatologist with a Brooklyn-first practice. Treatments emphasize subtle, repeatable results.',
    profilePhotoUrl: 'https://i.pravatar.cc/200?img=42',
    languages: ['English', 'Spanish'], gender: 'Female',
    treatmentSlugs: ['botox', 'dysport', 'lip-filler', 'tear-trough', 'microneedling'],
    pricingBotoxPerUnit: 13, startingPrice: 380,
    acceptsNewPatients: true, offersVirtualConsult: true, offersInPerson: true,
    aggregateRating: 4.8, aggregateRatingCount: 290,
    sourceUrls: [{ url: 'https://injector.world/seed' }],
  },

  // Rodeo Drive Dermatology (LA)
  {
    providerId: 'prov-la-00001', fullName: 'Dr. Marcus Hill, MD', slug: 'marcus-hill-md-la',
    credentials: 'MD', title: 'Board-Certified Plastic Surgeon',
    boardCertifications: [{ name: 'Plastic Surgery, ABPS' }],
    licenseNumber: 'A98345', licenseState: 'CA', licenseStatus: 'Active',
    licenseVerificationUrl: 'https://search.dca.ca.gov/',
    yearsExperience: 18, yearStartedPracticing: 2008, clinicRefId: 'clinic-la-00001',
    tagline: 'Beverly Hills plastic surgeon with a long injectable history.',
    bio: 'Eighteen years of practice. Trained at UCLA. Known for biostimulator protocols and natural-looking outcomes.',
    profilePhotoUrl: 'https://i.pravatar.cc/200?img=12',
    languages: ['English'], gender: 'Male',
    treatmentSlugs: ['botox', 'sculptra', 'kybella', 'cheek-filler', 'jawline-filler'],
    pricingBotoxPerUnit: 16, startingPrice: 600,
    acceptsNewPatients: true, offersVirtualConsult: true, offersInPerson: true,
    aggregateRating: 4.9, aggregateRatingCount: 388,
    editorsPick: true, featuredRank: 3,
    sourceUrls: [{ url: 'https://injector.world/seed' }],
  },
  {
    providerId: 'prov-la-00002', fullName: 'Hailey Brennan, RN', slug: 'hailey-brennan-rn-la',
    credentials: 'RN', title: 'Aesthetic Registered Nurse',
    licenseNumber: 'RN850221', licenseState: 'CA', licenseStatus: 'Active',
    licenseVerificationUrl: 'https://search.dca.ca.gov/',
    yearsExperience: 6, yearStartedPracticing: 2020, clinicRefId: 'clinic-la-00001',
    tagline: 'Lip-focused aesthetic RN under MD supervision.',
    bio: 'Six years of practice. Trained under a board-certified plastic surgeon, focus on lip aesthetics.',
    profilePhotoUrl: 'https://i.pravatar.cc/200?img=32',
    languages: ['English'], gender: 'Female',
    treatmentSlugs: ['botox', 'lip-filler', 'microneedling'],
    pricingBotoxPerUnit: 14, startingPrice: 480,
    acceptsNewPatients: true, offersVirtualConsult: false, offersInPerson: true,
    aggregateRating: 4.8, aggregateRatingCount: 220,
    sourceUrls: [{ url: 'https://injector.world/seed' }],
  },

  // Brickell Aesthetic Medicine (Miami)
  {
    providerId: 'prov-mia-00001', fullName: 'Dr. Aisha Bello, MD', slug: 'aisha-bello-md-mia',
    credentials: 'MD', title: 'Board-Certified Facial Plastic Surgeon',
    boardCertifications: [{ name: 'Facial Plastic Surgery, ABFPRS' }],
    licenseNumber: 'ME115662', licenseState: 'FL', licenseStatus: 'Active',
    licenseVerificationUrl: 'https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders',
    yearsExperience: 13, yearStartedPracticing: 2013, clinicRefId: 'clinic-mia-00001',
    tagline: 'Thread and biostimulator specialist.',
    bio: 'Facial plastic surgeon with a Miami practice. Focus on natural-looking thread lifts and Sculptra protocols.',
    profilePhotoUrl: 'https://i.pravatar.cc/200?img=49',
    languages: ['English', 'Spanish'], gender: 'Female',
    treatmentSlugs: ['botox', 'sculptra', 'thread-lift', 'cheek-filler', 'jawline-filler'],
    pricingBotoxPerUnit: 14, startingPrice: 480,
    acceptsNewPatients: true, offersVirtualConsult: true, offersInPerson: true,
    aggregateRating: 5.0, aggregateRatingCount: 294,
    editorsPick: true, featuredRank: 5,
    sourceUrls: [{ url: 'https://injector.world/seed' }],
  },
  {
    providerId: 'prov-mia-00002', fullName: 'Lucas Almeida, PA', slug: 'lucas-almeida-pa-mia',
    credentials: 'PA', title: 'Physician Assistant, Aesthetic Medicine',
    licenseNumber: 'PA9921055', licenseState: 'FL', licenseStatus: 'Active',
    licenseVerificationUrl: 'https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders',
    yearsExperience: 5, yearStartedPracticing: 2021, clinicRefId: 'clinic-mia-00001',
    tagline: 'Brickell-based aesthetic PA.',
    bio: 'Five years in aesthetic medicine. Focus on neurotoxins and microneedling.',
    profilePhotoUrl: 'https://i.pravatar.cc/200?img=8',
    languages: ['English', 'Portuguese', 'Spanish'], gender: 'Male',
    treatmentSlugs: ['botox', 'dysport', 'lip-filler', 'microneedling'],
    pricingBotoxPerUnit: 12, startingPrice: 380,
    acceptsNewPatients: true, offersVirtualConsult: false, offersInPerson: true,
    aggregateRating: 4.7, aggregateRatingCount: 178,
    sourceUrls: [{ url: 'https://injector.world/seed' }],
  },

  // River North Skin (Chicago)
  {
    providerId: 'prov-chi-00001', fullName: 'Dr. James Whitaker, DO', slug: 'james-whitaker-do-chi',
    credentials: 'DO', title: 'Board-Certified Aesthetic Medicine',
    boardCertifications: [{ name: 'Aesthetic Medicine, AAAM' }],
    licenseNumber: 'DO036.121456', licenseState: 'IL', licenseStatus: 'Active',
    licenseVerificationUrl: 'https://online-dfpr.micropact.com/Lookup/LicenseLookup.aspx',
    yearsExperience: 12, yearStartedPracticing: 2014, clinicRefId: 'clinic-chi-00001',
    tagline: 'Midwest aesthetic medicine practice.',
    bio: 'Twelve years of practice. Teaches injection technique to advanced practitioners.',
    profilePhotoUrl: 'https://i.pravatar.cc/200?img=14',
    languages: ['English'], gender: 'Male',
    treatmentSlugs: ['botox', 'dysport', 'tear-trough', 'kybella', 'prp'],
    pricingBotoxPerUnit: 13, startingPrice: 440,
    acceptsNewPatients: true, offersVirtualConsult: true, offersInPerson: true,
    aggregateRating: 4.8, aggregateRatingCount: 332,
    editorsPick: true, featuredRank: 6,
    sourceUrls: [{ url: 'https://injector.world/seed' }],
  },
  {
    providerId: 'prov-chi-00002', fullName: 'Mia Petrova, NP', slug: 'mia-petrova-np-chi',
    credentials: 'NP', title: 'Aesthetic Nurse Practitioner',
    licenseNumber: 'APN041019288', licenseState: 'IL', licenseStatus: 'Active',
    licenseVerificationUrl: 'https://online-dfpr.micropact.com/Lookup/LicenseLookup.aspx',
    yearsExperience: 7, yearStartedPracticing: 2019, clinicRefId: 'clinic-chi-00001',
    tagline: 'Lip and tear trough focused NP.',
    bio: 'Trained under Dr. Whitaker. Focus on subtle lip aesthetics and tear-trough placement.',
    profilePhotoUrl: 'https://i.pravatar.cc/200?img=26',
    languages: ['English', 'Russian'], gender: 'Female',
    treatmentSlugs: ['botox', 'lip-filler', 'tear-trough'],
    pricingBotoxPerUnit: 12, startingPrice: 380,
    acceptsNewPatients: true, offersVirtualConsult: false, offersInPerson: true,
    aggregateRating: 4.9, aggregateRatingCount: 244,
    sourceUrls: [{ url: 'https://injector.world/seed' }],
  },

  // Pacific Heights Dermatology (SF)
  {
    providerId: 'prov-sf-00001', fullName: 'Dr. Priya Shah, MD', slug: 'priya-shah-md-sf',
    credentials: 'MD', title: 'Board-Certified Dermatologist',
    boardCertifications: [{ name: 'Dermatology, ABD' }],
    licenseNumber: 'A105671', licenseState: 'CA', licenseStatus: 'Active',
    licenseVerificationUrl: 'https://search.dca.ca.gov/',
    yearsExperience: 10, yearStartedPracticing: 2016, clinicRefId: 'clinic-sf-00001',
    tagline: 'Skin of color expert with PRP focus.',
    bio: 'Ten years in dermatology with subspecialty focus on injectables in skin of color and PRP protocols.',
    profilePhotoUrl: 'https://i.pravatar.cc/200?img=39',
    languages: ['English', 'Hindi'], gender: 'Female',
    treatmentSlugs: ['botox', 'lip-filler', 'prp', 'microneedling'],
    pricingBotoxPerUnit: 17, startingPrice: 560,
    acceptsNewPatients: true, offersVirtualConsult: true, offersInPerson: true,
    aggregateRating: 4.9, aggregateRatingCount: 275,
    sourceUrls: [{ url: 'https://injector.world/seed' }],
  },
]

// ===== REVIEWS (40) =====
type ReviewSeed = {
  reviewId: string; providerRefId?: string; clinicRefId: string;
  reviewerFirstName?: string; reviewerInitial?: string; reviewerAgeRange?: string; reviewerCity?: string;
  rating: number; reviewTitle?: string; reviewText: string; treatmentTag?: string;
  reviewDate: string;
  sourcePlatform: string; sourceUrl: string;
  verified?: boolean; featured?: boolean;
}

const reviewBodies = [
  ['Maya', 'R', '30-34', 'Brooklyn Heights', 5, 'Subtle and exactly what I asked for', 'Spent 15 minutes asking about my face before suggesting units. Result is subtle, exactly what I wanted. Will be back in 4 months.', 'Botox'],
  ['Priya', 'S', '35-39', 'Midtown', 5, 'Best decision I made this year', 'Talked me out of treatments I didn\'t actually need. Conservative approach and zero upsell pressure.', 'Cheek Filler'],
  ['Jasmine', 'T', '25-29', 'West Village', 5, 'TMJ relief on top of jaw slimming', 'Came for jaw slimming and got TMJ relief as a side benefit. Explained everything, no upsell.', 'Masseter Botox'],
  ['Aanya', 'K', '40-44', 'Tribeca', 5, 'Honest and steady', 'I was nervous about under-eye filler. Rachel showed me her own face and her approach. Five months in and still happy.', 'Tear Trough Filler'],
  ['Carla', 'M', '35-39', 'Upper West Side', 5, 'Worth the drive', '20 minutes mapping my face before any needle touched. That alone earned my trust. Drive from Brooklyn for her.', 'Botox'],
  ['Tessa', 'W', '30-34', 'Williamsburg', 5, 'Lasted the full four months', 'Friendly without being chatty. Result was natural and lasted the full 4 months. Booked my next session.', 'Botox'],
  ['Sara', 'H', '40-44', 'Park Slope', 4, 'Solid result, slightly long wait', 'Honest pricing and a good outcome. The wait at check-in was a little long but the appointment itself was perfect.', 'Botox'],
  ['Olivia', 'N', '25-29', 'Astoria', 5, 'First-timer, glad I chose here', 'First time getting Botox. The consultation was patient and they didn\'t push extras. Going back in 3 months.', 'Botox'],
  ['Naomi', 'P', '30-34', 'Soho', 5, 'Lip filler I actually like', 'Filler that adds shape without looking done. Most natural lip work I\'ve seen.', 'Lip Filler'],
  ['Mike', 'D', '35-39', 'Long Island City', 5, 'TMJ pain finally gone', 'Came in for jaw clenching, got both relief and a leaner profile. Worth every dollar.', 'Masseter Botox'],
  ['Riya', 'C', '30-34', 'Beverly Hills', 5, 'Natural Sculptra results', 'The biostimulator results built slowly and look like I just look more rested. No one has guessed.', 'Sculptra'],
  ['Megan', 'O', '25-29', 'Santa Monica', 5, 'Best LA injector I have tried', 'Tried two others before this one. Best result I\'ve ever had. Won\'t go anywhere else.', 'Lip Filler'],
  ['Sophia', 'V', '35-39', 'Brickell', 5, 'Thread lift that actually held', 'Three months in and the lift is still visible. They were upfront about expected duration.', 'Thread Lift'],
  ['Camila', 'R', '40-44', 'Brickell', 5, 'Detailed consult', 'Took 45 minutes for the consult. Recommended fewer units than I asked for. That was the right call.', 'Botox'],
  ['Ana', 'L', '30-34', 'Coral Gables', 4, 'Solid result, longer recovery than expected', 'Bruising lasted 5 days. Final result is great, just plan around the first week.', 'Cheek Filler'],
  ['Jordan', 'B', '35-39', 'River North', 5, 'Whitaker is a real teacher', 'Explained why each unit, where, and why not others. Felt like a class. Result is exactly what I wanted.', 'Botox'],
  ['Hailey', 'J', '25-29', 'Lincoln Park', 4, 'Good, slightly pricier than expected', 'Pricing wasn\'t the cheapest in Chicago but the technique was clearly above average.', 'Botox'],
  ['Diana', 'P', '30-34', 'River North', 5, 'PRP after-care was perfect', 'Microneedling plus PRP. Skin texture is the best it has been since my 20s.', 'PRP Therapy'],
  ['Ali', 'M', '35-39', 'Pacific Heights', 5, 'Skin of color expertise mattered', 'I had been told to avoid certain treatments because of my skin tone. Priya knew exactly which to recommend instead.', 'Microneedling'],
  ['Naina', 'B', '30-34', 'Marina', 5, 'Lip filler done right', 'Did not look swollen the next day. Result is exactly as we discussed.', 'Lip Filler'],
  ['Jenna', 'F', '25-29', 'Buckhead', 5, 'Sculptra was the right call', 'Recommended Sculptra over filler for my face shape. Built slowly and looks natural.', 'Sculptra'],
  ['Bea', 'H', '30-34', 'Brickell', 4, 'Great front desk too', 'Booking was easy. Reminders helpful. Treatment itself was quick and the result is subtle.', 'Botox'],
  ['Lila', 'K', '40-44', 'Tribeca', 5, 'My second time, again excellent', 'Returning patient. Always conservative, always honest about what will and won\'t work.', 'Tear Trough Filler'],
  ['Aria', 'Y', '25-29', 'Upper East Side', 5, 'Best Botox of my life', 'I\'ve been to four injectors. Lena is the only one whose work I keep coming back for.', 'Botox'],
  ['Ravi', 'S', '35-39', 'Midtown', 5, 'Daniel knows the jaw', 'Asked Daniel for masseter. He explained why I should get fewer units the first time. Glad he did.', 'Masseter Botox'],
  ['Maya', 'V', '30-34', 'Soho', 5, 'Microneedling visible in 2 weeks', 'Texture started smoothing by the second session. Booked the package.', 'Microneedling'],
  ['Jessica', 'C', '40-44', 'West Village', 5, 'Five-star experience all around', 'From check-in to follow-up, professional and warm. Would refer my mom.', 'Botox'],
  ['Ruth', 'E', '35-39', 'Park Slope', 5, 'Worth crossing boroughs', 'Travel from Park Slope for these appointments. Worth every minute.', 'Lip Filler'],
  ['Sienna', 'G', '25-29', 'Williamsburg', 4, 'Good first impression', 'Came in nervous. Left calm. Result is subtle and lasted longer than I expected.', 'Dysport'],
  ['Bri', 'M', '30-34', 'Bushwick', 5, 'Going back for round two', 'My first ever Botox. Lasted the full 4 months. Already on the calendar for next round.', 'Botox'],
  ['Tara', 'R', '35-39', 'Long Beach', 4, 'Good result, took a few days', 'Effect peaked at day 14 exactly as he predicted. Subtle and natural.', 'Botox'],
  ['Cassie', 'B', '30-34', 'Venice', 5, 'Sculpted but natural', 'Lifted my mid-face without looking done. Several friends asked if I lost weight.', 'Cheek Filler'],
  ['Hana', 'P', '25-29', 'Wynwood', 5, 'Lucas is a steady hand', 'Quick and painless. Bruising was minimal.', 'Lip Filler'],
  ['Stella', 'A', '35-39', 'Wicker Park', 5, 'Kybella worked', 'Two sessions for the chin. Visible result, no surgery.', 'Kybella'],
  ['Maddy', 'L', '30-34', 'Andersonville', 5, 'TMJ relief in one session', 'My TMJ pain dropped within 2 weeks. Side benefit: I look less puffy.', 'Masseter Botox'],
  ['Quinn', 'D', '40-44', 'Nob Hill', 5, 'Priya explains everything', 'I asked too many questions. She answered every one. Booked the next session before I left.', 'Botox'],
  ['Imani', 'R', '35-39', 'Mission', 4, 'Skin-of-color expert', 'Most providers I had tried did not specialize in skin of color. This one does.', 'PRP Therapy'],
  ['Vivian', 'K', '30-34', 'Hayes Valley', 5, 'Best lip filler in SF', 'Subtle, balanced, hydrated. No duck lips.', 'Lip Filler'],
  ['Jen', 'L', '25-29', 'River North', 4, 'Solid result', 'Result is good. Office is clean and modern. Will come back.', 'Botox'],
  ['Naya', 'S', '30-34', 'Brickell', 5, 'Aisha is a craftsman', 'Treats injectables like sculpture. Her work is visible without being obvious.', 'Cheek Filler'],
]

const providerByIndex = [
  'prov-nyc-00001','prov-nyc-00002','prov-nyc-00003','prov-nyc-00004','prov-nyc-00005',
  'prov-nyc-00006','prov-nyc-00007','prov-nyc-00008','prov-la-00001','prov-la-00002',
  'prov-mia-00001','prov-mia-00002','prov-chi-00001','prov-chi-00002','prov-sf-00001',
]
const clinicByProvider: Record<string, string> = {
  'prov-nyc-00001':'clinic-nyc-00001','prov-nyc-00002':'clinic-nyc-00001','prov-nyc-00003':'clinic-nyc-00001',
  'prov-nyc-00004':'clinic-nyc-00002','prov-nyc-00005':'clinic-nyc-00002',
  'prov-nyc-00006':'clinic-nyc-00003','prov-nyc-00007':'clinic-nyc-00003',
  'prov-nyc-00008':'clinic-nyc-00004',
  'prov-la-00001':'clinic-la-00001','prov-la-00002':'clinic-la-00001',
  'prov-mia-00001':'clinic-mia-00001','prov-mia-00002':'clinic-mia-00001',
  'prov-chi-00001':'clinic-chi-00001','prov-chi-00002':'clinic-chi-00001',
  'prov-sf-00001':'clinic-sf-00001',
}

export const reviews: ReviewSeed[] = reviewBodies.map((row, i) => {
  const [first, initial, age, city, rating, title, text, tag] = row as [string, string, string, string, number, string, string, string]
  const provRef = providerByIndex[i % providerByIndex.length]
  const dateOffset = i * 4
  const d = new Date(2026, 3, 1 + dateOffset)
  return {
    reviewId: `rev-${String(i + 1).padStart(8, '0')}`,
    providerRefId: provRef, clinicRefId: clinicByProvider[provRef],
    reviewerFirstName: first, reviewerInitial: initial,
    reviewerAgeRange: age, reviewerCity: city, rating, reviewTitle: title,
    reviewText: text, treatmentTag: tag, reviewDate: d.toISOString().slice(0, 10),
    sourcePlatform: ['google','google','injectors_world','google','injectors_world'][i % 5],
    sourceUrl: 'https://injector.world/seed', verified: true, featured: i < 6,
  }
})

// ===== BEFORE / AFTER CASES (12) =====
type BeforeAfter = {
  caseTitle: string; beforePhotoUrl: string; afterPhotoUrl: string;
  treatmentTag: string; weeksPost: number; providerRefId?: string;
  city: string; state: string; patientNote?: string;
  consentGranted: boolean; featured?: boolean; sortRank?: number;
}
export const beforeAfterCases: BeforeAfter[] = [
  { caseTitle: 'Lip filler, 2 weeks post', beforePhotoUrl: 'https://picsum.photos/seed/ba-1a/400/500', afterPhotoUrl: 'https://picsum.photos/seed/ba-1b/400/500', treatmentTag: 'Lip Filler', weeksPost: 2, providerRefId: 'prov-nyc-00006', city: 'New York', state: 'NY', consentGranted: true, featured: true, sortRank: 1 },
  { caseTitle: 'Tear trough, 4 weeks post', beforePhotoUrl: 'https://picsum.photos/seed/ba-2a/400/500', afterPhotoUrl: 'https://picsum.photos/seed/ba-2b/400/500', treatmentTag: 'Tear Trough Filler', weeksPost: 4, providerRefId: 'prov-nyc-00001', city: 'New York', state: 'NY', consentGranted: true, featured: true, sortRank: 2 },
  { caseTitle: 'Masseter botox, 6 weeks post', beforePhotoUrl: 'https://picsum.photos/seed/ba-3a/400/500', afterPhotoUrl: 'https://picsum.photos/seed/ba-3b/400/500', treatmentTag: 'Masseter Botox', weeksPost: 6, providerRefId: 'prov-chi-00001', city: 'Chicago', state: 'IL', consentGranted: true, featured: true, sortRank: 3 },
  { caseTitle: 'Forehead botox, 3 weeks post', beforePhotoUrl: 'https://picsum.photos/seed/ba-4a/400/500', afterPhotoUrl: 'https://picsum.photos/seed/ba-4b/400/500', treatmentTag: 'Botox', weeksPost: 3, providerRefId: 'prov-sf-00001', city: 'San Francisco', state: 'CA', consentGranted: true, sortRank: 4 },
  { caseTitle: 'Cheek filler, 4 weeks post', beforePhotoUrl: 'https://picsum.photos/seed/ba-5a/400/500', afterPhotoUrl: 'https://picsum.photos/seed/ba-5b/400/500', treatmentTag: 'Cheek Filler', weeksPost: 4, providerRefId: 'prov-mia-00001', city: 'Miami', state: 'FL', consentGranted: true, sortRank: 5 },
  { caseTitle: 'Jawline filler, 2 weeks post', beforePhotoUrl: 'https://picsum.photos/seed/ba-6a/400/500', afterPhotoUrl: 'https://picsum.photos/seed/ba-6b/400/500', treatmentTag: 'Jawline Filler', weeksPost: 2, providerRefId: 'prov-la-00001', city: 'Beverly Hills', state: 'CA', consentGranted: true, sortRank: 6 },
  { caseTitle: 'Glabella botox, 2 weeks post', beforePhotoUrl: 'https://picsum.photos/seed/ba-7a/400/500', afterPhotoUrl: 'https://picsum.photos/seed/ba-7b/400/500', treatmentTag: 'Botox', weeksPost: 2, providerRefId: 'prov-nyc-00003', city: 'New York', state: 'NY', consentGranted: true, sortRank: 7 },
  { caseTitle: 'Sculptra, 12 weeks post', beforePhotoUrl: 'https://picsum.photos/seed/ba-8a/400/500', afterPhotoUrl: 'https://picsum.photos/seed/ba-8b/400/500', treatmentTag: 'Sculptra', weeksPost: 12, providerRefId: 'prov-mia-00001', city: 'Miami', state: 'FL', consentGranted: true, sortRank: 8 },
  { caseTitle: 'Thread lift, 4 weeks post', beforePhotoUrl: 'https://picsum.photos/seed/ba-9a/400/500', afterPhotoUrl: 'https://picsum.photos/seed/ba-9b/400/500', treatmentTag: 'Thread Lift', weeksPost: 4, providerRefId: 'prov-mia-00001', city: 'Miami', state: 'FL', consentGranted: true, sortRank: 9 },
  { caseTitle: 'PRP, 6 weeks post', beforePhotoUrl: 'https://picsum.photos/seed/ba-10a/400/500', afterPhotoUrl: 'https://picsum.photos/seed/ba-10b/400/500', treatmentTag: 'PRP Therapy', weeksPost: 6, providerRefId: 'prov-sf-00001', city: 'San Francisco', state: 'CA', consentGranted: true, sortRank: 10 },
  { caseTitle: 'Microneedling, 8 weeks post', beforePhotoUrl: 'https://picsum.photos/seed/ba-11a/400/500', afterPhotoUrl: 'https://picsum.photos/seed/ba-11b/400/500', treatmentTag: 'Microneedling', weeksPost: 8, providerRefId: 'prov-nyc-00007', city: 'New York', state: 'NY', consentGranted: true, sortRank: 11 },
  { caseTitle: 'Lip filler refresh, 3 weeks post', beforePhotoUrl: 'https://picsum.photos/seed/ba-12a/400/500', afterPhotoUrl: 'https://picsum.photos/seed/ba-12b/400/500', treatmentTag: 'Lip Filler', weeksPost: 3, providerRefId: 'prov-la-00002', city: 'Beverly Hills', state: 'CA', consentGranted: true, sortRank: 12 },
]

// ===== GUIDES (6) =====
type GuideSeed = {
  title: string; slug: string; lede: string; coverImageUrl: string;
  category: 'treatment-guide'|'article'|'expert-qa'|'cost-report';
  treatmentSlug?: string; readTimeMin: number; sourcesCount?: number;
  authorSlug: string; reviewerSlug?: string;
  lastMedicallyReviewed?: string; publishedAt?: string;
  featured?: boolean;
}
export const guides: GuideSeed[] = [
  {
    title: 'Botox: The Complete Guide', slug: 'botox',
    lede: 'Everything to know before your first Botox appointment. What it is, what it costs, what the risks are, and how to choose an injector you trust.',
    coverImageUrl: 'https://picsum.photos/seed/guide-botox/1080/520',
    category: 'treatment-guide', treatmentSlug: 'botox',
    readTimeMin: 12, sourcesCount: 8,
    authorSlug: 'hannah-reyes', reviewerSlug: 'lena-park-md',
    lastMedicallyReviewed: '2026-05-18', publishedAt: '2026-05-18', featured: true,
  },
  {
    title: 'Botox vs Dysport: Which Lasts Longer?', slug: 'botox-vs-dysport',
    lede: 'A side-by-side breakdown of the two most common neurotoxins on the US market.',
    coverImageUrl: 'https://picsum.photos/seed/guide-bvd/1080/520',
    category: 'treatment-guide', treatmentSlug: 'dysport',
    readTimeMin: 9, sourcesCount: 6,
    authorSlug: 'hannah-reyes', reviewerSlug: 'marcus-hill-md',
    lastMedicallyReviewed: '2026-04-22', publishedAt: '2026-04-22',
  },
  {
    title: 'Masseter Botox: A Complete Guide', slug: 'masseter-botox',
    lede: 'Jaw slimming, TMJ relief, and what you actually feel during the treatment.',
    coverImageUrl: 'https://picsum.photos/seed/guide-masseter/1080/520',
    category: 'treatment-guide', treatmentSlug: 'masseter-botox',
    readTimeMin: 10, sourcesCount: 7,
    authorSlug: 'devin-rao', reviewerSlug: 'james-whitaker-do',
    lastMedicallyReviewed: '2026-03-15', publishedAt: '2026-03-15',
  },
  {
    title: 'How to Choose an Aesthetic Injector', slug: 'how-to-choose-injector',
    lede: 'The seven questions to ask before you sit in the chair, from a dermatologist who has seen the bad outcomes.',
    coverImageUrl: 'https://picsum.photos/seed/guide-choose/1080/520',
    category: 'article', readTimeMin: 8, sourcesCount: 5,
    authorSlug: 'hannah-reyes', reviewerSlug: 'lena-park-md',
    lastMedicallyReviewed: '2026-05-02', publishedAt: '2026-05-02', featured: true,
  },
  {
    title: 'Tear Trough Filler: When It Works and When It Doesn\'t', slug: 'tear-trough',
    lede: 'Under-eye filler is not for everyone. A guide to candidacy, technique, and red flags.',
    coverImageUrl: 'https://picsum.photos/seed/guide-tear-trough/1080/520',
    category: 'treatment-guide', treatmentSlug: 'tear-trough',
    readTimeMin: 11, sourcesCount: 6,
    authorSlug: 'devin-rao', reviewerSlug: 'priya-shah-md',
    lastMedicallyReviewed: '2026-04-10', publishedAt: '2026-04-10',
  },
  {
    title: 'What Botox Costs in 2026', slug: 'botox-cost-2026',
    lede: 'A region-by-region cost report based on data from 12,400 injectors.',
    coverImageUrl: 'https://picsum.photos/seed/guide-cost/1080/520',
    category: 'cost-report', treatmentSlug: 'botox',
    readTimeMin: 6, sourcesCount: 4,
    authorSlug: 'maya-iyer', reviewerSlug: 'lena-park-md',
    lastMedicallyReviewed: '2026-05-30', publishedAt: '2026-05-30', featured: true,
  },
]

// ===== FAQS (20) =====
export const faqs = [
  // Homepage FAQs
  { question: 'How does injector.world verify providers?', answer: 'We check every injector against the state medical board where they practice. License numbers are publicly displayed on every profile. Board certifications and fellowships are reviewed by our medical advisory board before a profile goes live.', scope: 'homepage', sortRank: 1 },
  { question: 'Is Botox safe?', answer: 'Botox is well-studied and considered safe when administered by a licensed, trained injector. The aesthetic doses are very small relative to the medical doses used for migraines and spasticity. Common side effects are bruising and headache that resolve in days.', scope: 'homepage', treatmentTag: 'Botox', sortRank: 2 },
  { question: 'How much does Botox cost?', answer: 'National average is around $14 per unit, with most patients using 20 to 40 units per session ($280 to $560 total). Northeast cities run higher ($16 to $18 per unit). Midwest and South are typically 10 to 20 percent lower.', scope: 'homepage', treatmentTag: 'Botox', sortRank: 3 },
  { question: 'What\'s the difference between an MD, NP, and RN injector?', answer: 'MDs and DOs have the broadest training but cost more. NPs and PAs can inject under physician supervision; many have excellent technique. RNs can inject in most states under direct supervision. Years of focused injection practice matters more than the letters.', scope: 'homepage', sortRank: 4 },
  { question: 'How do I prepare for my first appointment?', answer: 'Skip alcohol and blood thinners (Aspirin, Advil, fish oil, vitamin E) for 5 to 7 days to reduce bruising. Eat before the appointment. Bring a list of medications. Plan a quiet day after if you tend to bruise.', scope: 'homepage', sortRank: 5 },
  { question: 'Are reviews on injector.world real?', answer: 'Yes. Reviews are imported from public sources (Google, Healthgrades, Vitals, Zocdoc) and from our own moderated verified reviews. We do not allow injectors to delete reviews about themselves.', scope: 'homepage', sortRank: 6 },

  // Treatment-scoped FAQs
  { question: 'How long does Botox last?', answer: 'Typically 3 to 4 months. Some patients metabolize it faster, some slower. After several consistent treatments, many patients find the effect lasts a bit longer.', scope: 'treatment', treatmentTag: 'Botox', sortRank: 10 },
  { question: 'Does Botox hurt?', answer: 'Most patients rate the discomfort as a 2 or 3 out of 10. The needles are very fine. You feel a quick pinch at each injection site. The whole process is over in minutes.', scope: 'treatment', treatmentTag: 'Botox', sortRank: 11 },
  { question: 'Can I exercise after Botox?', answer: 'Wait 24 hours. Strenuous exercise increases blood flow and can displace the product before it settles. Light walking is fine the same day.', scope: 'treatment', treatmentTag: 'Botox', sortRank: 12 },
  { question: 'Will Botox make me look frozen?', answer: 'No, when administered correctly. A frozen look comes from too many units in the wrong placement. A well-trained injector uses fewer units in carefully chosen sites so you can still express. Communicate your preference clearly in the consult.', scope: 'treatment', treatmentTag: 'Botox', sortRank: 13 },
  { question: 'Is Botox safe long-term?', answer: 'Aesthetic doses are small relative to medical doses used for migraines or spasticity, where patients have been treated for decades. Long-term safety is well established. Mild muscle atrophy with prolonged use is reversible when treatments stop.', scope: 'treatment', treatmentTag: 'Botox', sortRank: 14 },
  { question: 'How long does lip filler last?', answer: '6 to 12 months for most patients. Hyaluronic acid metabolizes faster in active people and slower in those with lower facial movement. Touch-ups at 6 months are common.', scope: 'treatment', treatmentTag: 'Lip Filler', sortRank: 15 },
  { question: 'How many units of masseter botox do I need?', answer: 'Most patients need 20 to 30 units per side for jaw slimming or TMJ relief. Results are visible at 4 to 6 weeks. The masseter muscle thins gradually over months.', scope: 'treatment', treatmentTag: 'Masseter Botox', sortRank: 16 },
  { question: 'Is tear trough filler reversible?', answer: 'Yes, when hyaluronic acid filler is used. The dissolving enzyme hyaluronidase can be injected to break it down within 24 to 48 hours. Always confirm your injector keeps it on hand.', scope: 'treatment', treatmentTag: 'Tear Trough Filler', sortRank: 17 },

  // City-scoped FAQs
  { question: 'How much does Botox cost in New York City?', answer: 'NYC average is $14 to $18 per unit. Most patients pay $400 to $850 per session depending on the units used and the provider\'s credentials. Upper East Side and Tribeca are highest. Brooklyn and Queens are typically 15 to 25 percent lower.', scope: 'city', cityTag: 'New York', treatmentTag: 'Botox', sortRank: 20 },
  { question: 'Do I need an MD, or can a nurse practitioner inject Botox in NY?', answer: 'In New York State, NPs and PAs can legally inject under physician supervision. Both can do excellent work. Ask about their supervising physician, their training, and how long they have been injecting full-time.', scope: 'city', cityTag: 'New York', sortRank: 21 },
  { question: 'What\'s the average tip for an injector in NYC?', answer: 'Tipping is not expected for injectables in a medical setting. If your injector also offers facials or other spa services as part of your visit, tipping on those is appropriate. The Botox or filler itself, no tip needed.', scope: 'city', cityTag: 'New York', sortRank: 22 },
  { question: 'Which neighborhoods have the best Botox injectors in NYC?', answer: 'Upper East Side and Tribeca have the highest concentration of board-certified dermatologists. Midtown and Flatiron lean heavier on aesthetic-focused practices. Williamsburg and Park Slope have excellent NPs and PAs at more accessible prices. Pick by injector, not by zip code.', scope: 'city', cityTag: 'New York', sortRank: 23 },
  { question: 'Can I get same-day Botox in NYC?', answer: 'Yes, but only at providers who offer same-day slots. Use the "Same-day available" filter to narrow the list. A quality first-time consultation usually takes 30 to 45 minutes, so plan accordingly.', scope: 'city', cityTag: 'New York', sortRank: 24 },
  { question: 'How much does lip filler cost in Miami?', answer: 'Miami averages $750 to $1,100 per syringe. Brickell and South Beach lean higher. Most patients start with one syringe and decide on a second at the 2-week follow-up.', scope: 'city', cityTag: 'Miami', treatmentTag: 'Lip Filler', sortRank: 25 },
]

// ===== PHOTOS =====
const headshots: Array<{ id: string, providerId: string, url: string }> = providers.map((p, i) => ({
  id: `ph-headshot-${String(i+1).padStart(4,'0')}`,
  providerId: p.providerId,
  url: p.profilePhotoUrl,
}))
const clinicInteriors: Array<{ id: string, clinicId: string, url: string }> = clinics.flatMap((c, i) => [
  { id: `ph-clinic-${String(i+1).padStart(4,'0')}-int`, clinicId: c.clinicId, url: c.clinicPhotoUrls?.[0]?.url || `https://picsum.photos/seed/clinic-${i}/600/400` },
])
export const photos = [
  ...headshots.map((h) => ({
    photoId: h.id, photoUrl: h.url, type: 'headshot',
    sourcePlatform: 'injectors_world', sourceUrl: 'https://injector.world/seed',
    consentDocumented: true,
  })),
  ...clinicInteriors.map((c) => ({
    photoId: c.id, photoUrl: c.url, type: 'clinic_interior',
    sourcePlatform: 'injectors_world', sourceUrl: 'https://injector.world/seed',
    consentDocumented: true,
  })),
]

// ===== PROMOTIONS (seed: Botox + NYC, 3 slots) =====
// These reference providers by slug; seed.ts resolves to IDs before inserting.
export type PromotionSeed = {
  providerSlug: string
  scopeType: string
  treatmentSlug?: string
  locationSlug?: string
  rank: number
  active: boolean
  notes: string
  startDate?: string
  endDate?: string
}

export const promotions: PromotionSeed[] = [
  // Botox + NYC money page (treatment+city)
  {
    providerSlug: 'lena-park-md-nyc',
    scopeType: 'treatment+city',
    treatmentSlug: 'botox',
    locationSlug: 'new-york-ny',
    rank: 1, active: true,
    notes: 'Botox NYC Sponsored — rank 1',
    startDate: '2026-06-01',
  },
  {
    providerSlug: 'daniel-cho-md-nyc',
    scopeType: 'treatment+city',
    treatmentSlug: 'botox',
    locationSlug: 'new-york-ny',
    rank: 2, active: true,
    notes: 'Botox NYC Sponsored — rank 2',
    startDate: '2026-06-01',
  },
  {
    providerSlug: 'sofia-reyes-np-nyc',
    scopeType: 'treatment+city',
    treatmentSlug: 'botox',
    locationSlug: 'new-york-ny',
    rank: 3, active: true,
    notes: 'Botox NYC Sponsored — rank 3',
    startDate: '2026-06-01',
  },
  // New York state hub
  {
    providerSlug: 'rachel-goldman-md-nyc',
    scopeType: 'state',
    locationSlug: 'new-york',
    rank: 1, active: true,
    notes: 'NY State Sponsored — rank 1',
    startDate: '2026-06-01',
  },
  // NYC city hub (treatment-agnostic)
  {
    providerSlug: 'jenna-wu-pa-nyc',
    scopeType: 'city',
    locationSlug: 'new-york-ny',
    rank: 1, active: true,
    notes: 'NYC City Hub Sponsored — rank 1',
    startDate: '2026-06-01',
  },
]

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
