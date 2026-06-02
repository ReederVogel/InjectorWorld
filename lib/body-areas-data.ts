/**
 * Body areas shown in the carousel below the Hero.
 * Image URLs use picsum seeds for reliability (always resolve).
 * Swap to real lifestyle photography via /admin once Photos collection has uploads.
 */
export type BodyArea = {
  slug: string
  name: string
  tagline: string
  treatments: string
  imageUrl: string
}

export const bodyAreas: BodyArea[] = [
  { slug: 'forehead', name: 'Forehead', tagline: 'Soften horizontal lines.', treatments: 'Botox · Dysport', imageUrl: 'https://picsum.photos/seed/area-forehead-portrait/600/800' },
  { slug: 'brow', name: 'Brow', tagline: 'Lift the tail of the brow.', treatments: 'Brow Lift Botox', imageUrl: 'https://picsum.photos/seed/area-brow-beauty/600/800' },
  { slug: 'under-eye', name: 'Under Eye', tagline: 'For hollows and dark shadows.', treatments: 'Tear Trough Filler', imageUrl: 'https://picsum.photos/seed/area-undereye-closeup/600/800' },
  { slug: 'crows-feet', name: "Crow's Feet", tagline: 'Relax the muscles around the outer eye.', treatments: 'Botox · Dysport', imageUrl: 'https://picsum.photos/seed/area-crowsfeet-eyes/600/800' },
  { slug: 'cheeks', name: 'Cheeks', tagline: 'Lift the mid-face.', treatments: 'Cheek Filler · Sculptra', imageUrl: 'https://picsum.photos/seed/area-cheeks-bone/600/800' },
  { slug: 'lips', name: 'Lips', tagline: 'Subtle volume and hydration.', treatments: 'Lip Filler · Lip Flip', imageUrl: 'https://picsum.photos/seed/area-lips-natural/600/800' },
  { slug: 'chin', name: 'Chin', tagline: 'Project the chin or dissolve fullness.', treatments: 'Chin Filler · Kybella', imageUrl: 'https://picsum.photos/seed/area-chin-jawline/600/800' },
  { slug: 'jawline', name: 'Jawline', tagline: 'Contour or slim the lower face.', treatments: 'Jawline Filler · Masseter Botox', imageUrl: 'https://picsum.photos/seed/area-jawline-profile/600/800' },
  { slug: 'neck', name: 'Neck', tagline: 'Soften bands, improve texture.', treatments: 'Neck Botox · Profhilo', imageUrl: 'https://picsum.photos/seed/area-neck-skin/600/800' },
  { slug: 'decolletage', name: 'Décolletage', tagline: 'Hydrate and resurface the upper chest.', treatments: 'Skin Boosters · Microneedling', imageUrl: 'https://picsum.photos/seed/area-decolletage-collar/600/800' },
]
