/**
 * Central nav definitions. Used by Header and Footer.
 * Mega-menu panels also draw from here.
 */
export type NavLink = { label: string; href: string; comingSoon?: boolean }
export type MegaSection = { heading: string; links: NavLink[] }
export type MegaFeature = {
  imageUrl: string
  overline: string
  title: string
  cta: { label: string; href: string }
}
export type MegaMenu = {
  key: 'services' | 'cities' | 'guides'
  trigger: string
  sections: MegaSection[]
  feature?: MegaFeature
}

export const serviceLinks: NavLink[] = [
  { label: 'Botox', href: '/services/botox' },
  { label: 'Cheek Filler', href: '/services/cheek-filler' },
  { label: 'Daxxify', href: '/services/daxxify' },
  { label: 'Dysport', href: '/services/dysport' },
  { label: 'Jawline Filler', href: '/services/jawline-filler' },
  { label: 'Jeuveau', href: '/services/jeuveau' },
  { label: 'Kybella', href: '/services/kybella' },
  { label: 'Lip Filler', href: '/services/lip-filler' },
  { label: 'Masseter Botox', href: '/services/masseter-botox' },
  { label: 'Microneedling', href: '/services/microneedling' },
  { label: 'PRP', href: '/services/prp' },
  { label: 'Sculptra', href: '/services/sculptra' },
  { label: 'Tear Trough', href: '/services/tear-trough' },
  { label: 'Thread Lift', href: '/services/thread-lift' },
  { label: 'Xeomin', href: '/services/xeomin' },
]

export const megaMenus: MegaMenu[] = [
  {
    key: 'services',
    trigger: 'Services',
    sections: [
      {
        heading: 'All Services',
        links: serviceLinks,
      },
    ],
    feature: {
      imageUrl: 'https://picsum.photos/seed/mega-services/400/200',
      overline: 'Featured guide',
      title: 'Botox: The Complete Guide',
      cta: { label: 'Read the guide', href: '/guides/botox' },
    },
  },
  {
    key: 'cities',
    trigger: 'Cities',
    sections: [
      {
        heading: 'Northeast',
        links: [
          { label: 'New York City', href: '/services/botox/new-york/new-york-city' },
          { label: 'Boston', href: '/services/botox/massachusetts/boston' },
          { label: 'Washington DC', href: '/services/botox/washington-dc/washington' },
          { label: 'Philadelphia', href: '/services/botox/pennsylvania/philadelphia' },
        ],
      },
      {
        heading: 'West',
        links: [
          { label: 'Los Angeles', href: '/services/botox/california/los-angeles' },
          { label: 'San Francisco', href: '/services/botox/california/san-francisco' },
          { label: 'Seattle', href: '/services/botox/washington/seattle' },
          { label: 'Phoenix', href: '/services/botox/arizona/phoenix' },
          { label: 'Denver', href: '/services/botox/colorado/denver' },
          { label: 'Portland', href: '/services/botox/oregon/portland' },
          { label: 'San Diego', href: '/services/botox/california/san-diego' },
        ],
      },
      {
        heading: 'South & Midwest',
        links: [
          { label: 'Miami', href: '/services/botox/florida/miami' },
          { label: 'Atlanta', href: '/services/botox/georgia/atlanta' },
          { label: 'Houston', href: '/services/botox/texas/houston' },
          { label: 'Dallas', href: '/services/botox/texas/dallas' },
          { label: 'Austin', href: '/services/botox/texas/austin' },
          { label: 'Nashville', href: '/services/botox/tennessee/nashville' },
          { label: 'Chicago', href: '/services/botox/illinois/chicago' },
        ],
      },
    ],
    feature: {
      imageUrl: 'https://picsum.photos/seed/mega-cities/400/200',
      overline: 'Spotlight',
      title: 'Botox in New York City',
      cta: { label: 'See 1,240 injectors', href: '/services/botox/new-york/new-york-city' },
    },
  },
  {
    key: 'guides',
    trigger: 'Guides',
    sections: [
      {
        heading: 'By treatment',
        links: [
          { label: 'Botox', href: '/guides/botox' },
          { label: 'Lip Filler', href: '/guides/lip-filler' },
          { label: 'Masseter Botox', href: '/guides/masseter-botox' },
          { label: 'Tear Trough', href: '/guides/tear-trough' },
        ],
      },
      {
        heading: 'By concern',
        links: [
          { label: 'How to choose an injector', href: '/guides/how-to-choose-injector' },
          { label: 'First-time Botox', href: '/guides/first-time-botox' },
          { label: 'Botox vs Filler', href: '/guides/botox-vs-filler' },
          { label: 'Red flags before booking', href: '/guides/red-flags' },
        ],
      },
      {
        heading: 'Cost & safety',
        links: [
          { label: 'What Botox costs in 2026', href: '/guides/botox-cost-2026' },
          { label: 'Is Botox safe?', href: '/guides/is-botox-safe' },
          { label: 'Botox side effects', href: '/guides/botox-side-effects' },
          { label: 'MD vs NP vs RN', href: '/guides/md-vs-np-vs-rn' },
        ],
      },
    ],
    feature: {
      imageUrl: 'https://picsum.photos/seed/mega-guides/400/200',
      overline: 'Latest',
      title: 'How to Choose an Aesthetic Injector',
      cta: { label: 'Read the guide', href: '/guides/how-to-choose-injector' },
    },
  },
]

export const flatNavLinks: NavLink[] = [
  { label: 'Injectors', href: '/injectors' },
  { label: 'Clinics', href: '/clinics' },
  // { label: 'News', href: '/news' }, // hidden until /news page exists
]

export const footerLinks = {
  services: [
    { label: 'Botox', href: '/services/botox' },
    { label: 'Cheek Filler', href: '/services/cheek-filler' },
    { label: 'Dysport', href: '/services/dysport' },
    { label: 'Jawline Filler', href: '/services/jawline-filler' },
    { label: 'Lip Filler', href: '/services/lip-filler' },
    { label: 'Masseter Botox', href: '/services/masseter-botox' },
    { label: 'Sculptra', href: '/services/sculptra' },
    { label: 'Tear Trough', href: '/services/tear-trough' },
  ],
  topStates: [
    { label: 'New York', href: '/services/botox/new-york' },
    { label: 'California', href: '/services/botox/california' },
    { label: 'Florida', href: '/services/botox/florida' },
    { label: 'Texas', href: '/services/botox/texas' },
    { label: 'Illinois', href: '/services/botox/illinois' },
    { label: 'Colorado', href: '/services/botox/colorado' },
  ],
  cities: [
    { label: 'New York City', href: '/services/botox/new-york/new-york-city' },
    { label: 'Los Angeles', href: '/services/botox/california/los-angeles' },
    { label: 'Miami', href: '/services/botox/florida/miami' },
    { label: 'Chicago', href: '/services/botox/illinois/chicago' },
    { label: 'Houston', href: '/services/botox/texas/houston' },
    { label: 'Austin', href: '/services/botox/texas/austin' },
  ],
  guides: [
    { label: 'Botox guide', href: '/guides/botox' },
    { label: 'Lip filler', href: '/guides/lip-filler' },
    { label: 'First-time Botox', href: '/guides/first-time-botox' },
    { label: 'Botox cost 2026', href: '/guides/botox-cost-2026' },
    { label: 'MD vs NP vs RN', href: '/guides/md-vs-np-vs-rn' },
    { label: 'Is Botox safe?', href: '/guides/is-botox-safe' },
  ],
  company: [
    { label: 'About', href: '/about' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'List your practice', href: '/list-your-practice' },
    { label: 'Editorial standards', href: '/editorial-standards' },
    { label: 'Medical advisory', href: '/medical-advisory' },
    { label: 'Press', href: '/press' },
    { label: 'Careers', href: '/careers' },
  ],
  legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'HIPAA notice', href: '/hipaa' },
    { label: 'Contact', href: '/contact' },
  ],
}

/* ──────────────────────────────────────────────────────────────────────────
 * CARD NAV (live header — CardNavClient)
 * Single source of truth for the hamburger drawer. Each card has internal
 * sub-tabs so the whole catalogue fits without the card ever growing taller.
 * Add a treatment / city / guide here and it lands under the right tab — the
 * component renders it automatically. No component edits needed to scale.
 * ────────────────────────────────────────────────────────────────────────── */
export type NavTab = { key: string; label: string; links: NavLink[] }
export type NavCard = {
  label: string
  bg: string
  fg: string
  /** accent for tab underline + view-all, chosen per card for contrast */
  accent: string
  tabs: NavTab[]
  viewAll: NavLink
}
/** Editorial strip above the cards. Filled from latest News at request time;
 *  falls back to navLeadFallback when there is no published news. */
export type NavLead = {
  overline: string
  title: string
  href: string
  allLabel: string
  allHref: string
}

export const navCards: NavCard[] = [
  {
    label: 'Services',
    bg: '#0B1B34',
    fg: '#ffffff',
    accent: '#9FE1CB',
    tabs: [
      {
        key: 'all-services',
        label: 'All services',
        links: serviceLinks,
      },
    ],
    viewAll: { label: 'Browse all services', href: '/services' },
  },
  {
    label: 'Find',
    bg: '#3FA68A',
    fg: '#ffffff',
    accent: '#ffffff',
    tabs: [
      {
        key: 'cities',
        label: 'Cities',
        links: [
          { label: 'New York City', href: '/services/botox/new-york/new-york-city' },
          { label: 'Los Angeles', href: '/services/botox/california/los-angeles' },
          { label: 'Miami', href: '/services/botox/florida/miami' },
          { label: 'Houston', href: '/services/botox/texas/houston' },
          { label: 'Chicago', href: '/services/botox/illinois/chicago' },
          { label: 'Dallas', href: '/services/botox/texas/dallas' },
        ],
      },
      {
        key: 'states',
        label: 'States',
        links: [
          { label: 'California', href: '/services/botox/california' },
          { label: 'New York', href: '/services/botox/new-york' },
          { label: 'Florida', href: '/services/botox/florida' },
          { label: 'Texas', href: '/services/botox/texas' },
          { label: 'Illinois', href: '/services/botox/illinois' },
          { label: 'Colorado', href: '/services/botox/colorado' },
        ],
      },
      {
        key: 'browse',
        label: 'Browse',
        links: [
          { label: 'All injectors', href: '/injectors' },
          { label: 'All clinics', href: '/clinics' },
          { label: 'Browse by state', href: '/states' },
          { label: 'Practice groups', href: '/brands' },
        ],
      },
    ],
    viewAll: { label: 'Browse all locations', href: '/states' },
  },
  {
    label: 'Learn',
    bg: '#FAF7F2',
    fg: '#0B1B34',
    accent: '#3FA68A',
    tabs: [
      {
        key: 'guides',
        label: 'Guides',
        links: [
          { label: 'Botox guide', href: '/guides/botox' },
          { label: 'First-time Botox', href: '/guides/first-time-botox' },
          { label: 'What Botox costs in 2026', href: '/guides/botox-cost-2026' },
          { label: 'Is Botox safe?', href: '/guides/is-botox-safe' },
          { label: 'MD vs NP vs RN', href: '/guides/md-vs-np-vs-rn' },
        ],
      },
      {
        key: 'tools',
        label: 'Tools',
        links: [
          { label: 'Take the quiz', href: '/quiz' },
          { label: 'Expert Q&A', href: '/questions' },
          { label: 'Patient stories', href: '/patient-stories', comingSoon: true },
          { label: 'Video testimonials', href: '/videos', comingSoon: true },
        ],
      },
      {
        key: 'company',
        label: 'About',
        links: [
          { label: 'How we verify', href: '/how-we-verify' },
          { label: 'Editorial standards', href: '/editorial-standards' },
          { label: 'Medical advisory', href: '/medical-advisory' },
          { label: 'About injector.world', href: '/about' },
        ],
      },
    ],
    viewAll: { label: 'Browse all guides', href: '/guides' },
  },
]

export const navLeadFallback: NavLead = {
  overline: 'Featured guide',
  title: 'How to choose an aesthetic injector you can trust',
  href: '/guides/how-to-choose-injector',
  allLabel: 'All guides',
  allHref: '/guides',
}
