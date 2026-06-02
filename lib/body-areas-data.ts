export type BodyArea = {
  slug: string
  name: string
  tagline: string
  treatments: string
  imageUrlLight: string
  imageUrlDark: string
}

export const bodyAreas: BodyArea[] = [
  { slug: 'forehead',    name: 'Forehead',     tagline: 'Soften horizontal lines.',                  treatments: 'Botox · Dysport',                 imageUrlLight: '/images/body-areas/forehead_light.png',    imageUrlDark: '/images/body-areas/forehead_dark.png' },
  { slug: 'brow',        name: 'Brow',          tagline: 'Lift the tail of the brow.',                treatments: 'Brow Lift Botox',                 imageUrlLight: '/images/body-areas/brow_light.png',        imageUrlDark: '/images/body-areas/brow_dark.png' },
  { slug: 'under-eye',   name: 'Under Eye',     tagline: 'For hollows and dark shadows.',             treatments: 'Tear Trough Filler',              imageUrlLight: '/images/body-areas/undereye_light.png',    imageUrlDark: '/images/body-areas/undereye_dark.png' },
  { slug: 'crows-feet',  name: "Crow's Feet",   tagline: 'Relax the muscles around the outer eye.',  treatments: 'Botox · Dysport',                 imageUrlLight: '/images/body-areas/crowsfeet_light.png',   imageUrlDark: '/images/body-areas/crowsfeet_dark.png' },
  { slug: 'cheeks',      name: 'Cheeks',        tagline: 'Lift the mid-face.',                        treatments: 'Cheek Filler · Sculptra',         imageUrlLight: '/images/body-areas/cheeks_light.png',      imageUrlDark: '/images/body-areas/cheeks_dark.png' },
  { slug: 'lips',        name: 'Lips',          tagline: 'Subtle volume and hydration.',              treatments: 'Lip Filler · Lip Flip',           imageUrlLight: '/images/body-areas/lips_light.png',        imageUrlDark: '/images/body-areas/lips_dark.png' },
  { slug: 'chin',        name: 'Chin',          tagline: 'Project the chin or dissolve fullness.',   treatments: 'Chin Filler · Kybella',           imageUrlLight: '/images/body-areas/chin_light.png',        imageUrlDark: '/images/body-areas/chin_dark.png' },
  { slug: 'jawline',     name: 'Jawline',       tagline: 'Contour or slim the lower face.',          treatments: 'Jawline Filler · Masseter Botox', imageUrlLight: '/images/body-areas/jawline_light.png',     imageUrlDark: '/images/body-areas/jawline_dark.png' },
  { slug: 'neck',        name: 'Neck',          tagline: 'Soften bands, improve texture.',           treatments: 'Neck Botox · Profhilo',           imageUrlLight: '/images/body-areas/neck_light.png',        imageUrlDark: '/images/body-areas/neck_dark.png' },
  { slug: 'decolletage', name: 'Décolletage',   tagline: 'Hydrate and resurface the upper chest.',  treatments: 'Skin Boosters · Microneedling',   imageUrlLight: '/images/body-areas/decolletage_light.png', imageUrlDark: '/images/body-areas/decolletage_dark.png' },
]
