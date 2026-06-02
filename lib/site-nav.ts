/**
 * Central nav definitions. Used by Header and Footer.
 * Mega-menu panels also draw from here.
 */
export type NavLink = { label: string; href: string }
export type MegaSection = { heading: string; links: NavLink[] }
export type MegaFeature = {
  imageUrl: string
  overline: string
  title: string
  cta: { label: string; href: string }
}
export type MegaMenu = {
  key: 'treatments' | 'cities' | 'guides'
  trigger: string
  sections: MegaSection[]
  feature?: MegaFeature
}

export const megaMenus: MegaMenu[] = [
  {
    key: 'treatments',
    trigger: 'Treatments',
    sections: [
      {
        heading: 'By area',
        links: [
          { label: 'Forehead', href: '/treatments/forehead' },
          { label: 'Brow', href: '/treatments/brow' },
          { label: 'Under eye', href: '/treatments/under-eye' },
          { label: 'Cheeks', href: '/treatments/cheeks' },
          { label: 'Lips', href: '/treatments/lips' },
          { label: 'Jawline', href: '/treatments/jawline' },
          { label: 'Neck', href: '/treatments/neck' },
        ],
      },
      {
        heading: 'Neurotoxins',
        links: [
          { label: 'Botox', href: '/botox' },
          { label: 'Dysport', href: '/dysport' },
          { label: 'Xeomin', href: '/xeomin' },
          { label: 'Jeuveau', href: '/jeuveau' },
          { label: 'Daxxify', href: '/daxxify' },
          { label: 'Masseter Botox', href: '/masseter-botox' },
        ],
      },
      {
        heading: 'Fillers & more',
        links: [
          { label: 'Lip Filler', href: '/lip-filler' },
          { label: 'Cheek Filler', href: '/cheek-filler' },
          { label: 'Tear Trough', href: '/tear-trough' },
          { label: 'Sculptra', href: '/sculptra' },
          { label: 'Kybella', href: '/kybella' },
          { label: 'PRP & Microneedling', href: '/prp' },
        ],
      },
    ],
    feature: {
      imageUrl: 'https://picsum.photos/seed/mega-treatments/400/200',
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
          { label: 'New York City', href: '/botox/new-york-ny' },
          { label: 'Boston', href: '/botox/boston-ma' },
          { label: 'Washington DC', href: '/botox/washington-dc' },
          { label: 'Philadelphia', href: '/botox/philadelphia-pa' },
        ],
      },
      {
        heading: 'West',
        links: [
          { label: 'Los Angeles', href: '/botox/los-angeles-ca' },
          { label: 'San Francisco', href: '/botox/san-francisco-ca' },
          { label: 'Seattle', href: '/botox/seattle-wa' },
          { label: 'Phoenix', href: '/botox/phoenix-az' },
          { label: 'Denver', href: '/botox/denver-co' },
          { label: 'Portland', href: '/botox/portland-or' },
          { label: 'San Diego', href: '/botox/san-diego-ca' },
        ],
      },
      {
        heading: 'South & Midwest',
        links: [
          { label: 'Miami', href: '/botox/miami-fl' },
          { label: 'Atlanta', href: '/botox/atlanta-ga' },
          { label: 'Houston', href: '/botox/houston-tx' },
          { label: 'Dallas', href: '/botox/dallas-tx' },
          { label: 'Austin', href: '/botox/austin-tx' },
          { label: 'Nashville', href: '/botox/nashville-tn' },
          { label: 'Chicago', href: '/botox/chicago-il' },
        ],
      },
    ],
    feature: {
      imageUrl: 'https://picsum.photos/seed/mega-cities/400/200',
      overline: 'Spotlight',
      title: 'Botox in New York City',
      cta: { label: 'See 1,240 injectors', href: '/botox/new-york-ny' },
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
]

export const footerLinks = {
  treatments: [
    { label: 'Botox', href: '/botox' },
    { label: 'Dysport', href: '/dysport' },
    { label: 'Lip Filler', href: '/lip-filler' },
    { label: 'Cheek Filler', href: '/cheek-filler' },
    { label: 'Masseter', href: '/masseter-botox' },
    { label: 'Tear Trough', href: '/tear-trough' },
  ],
  topStates: [
    { label: 'New York', href: '/botox/new-york' },
    { label: 'California', href: '/botox/california' },
    { label: 'Florida', href: '/botox/florida' },
    { label: 'Texas', href: '/botox/texas' },
    { label: 'Illinois', href: '/botox/illinois' },
    { label: 'Colorado', href: '/botox/colorado' },
  ],
  cities: [
    { label: 'New York City', href: '/botox/new-york-ny' },
    { label: 'Los Angeles', href: '/botox/los-angeles-ca' },
    { label: 'Miami', href: '/botox/miami-fl' },
    { label: 'Chicago', href: '/botox/chicago-il' },
    { label: 'Houston', href: '/botox/houston-tx' },
    { label: 'Austin', href: '/botox/austin-tx' },
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
