export type SocialPost = {
  id: string
  quote: string
  author: {
    name: string
    handle: string
    avatarUrl: string
  }
  platform: 'x' | 'facebook' | 'instagram' | 'reddit' | 'google'
  likes: number
  rating?: number
  date: string
  href: string
  featured: boolean
}

export const socialPosts: SocialPost[] = [
  // Featured pull-quote cards (always shown, not filtered)
  {
    id: 'sp1',
    quote: "Finally found an injector who actually talked me out of getting more. She said my face didn't need it and she was right. That kind of honesty is rare.",
    author: { name: 'Caroline M.', handle: '@carolinem_nyc', avatarUrl: 'https://i.pravatar.cc/64?img=47' },
    platform: 'x',
    likes: 3200,
    date: 'Mar 2026',
    href: '#',
    featured: true,
  },
  {
    id: 'sp2',
    quote: "For anyone nervous about finding a good provider, use injectors.world. I vetted three through it and ended up with someone who has been injecting for 12 years. Worth every minute of research.",
    author: { name: 'skin_curious', handle: 'u/skin_curious', avatarUrl: 'https://i.pravatar.cc/64?img=22' },
    platform: 'reddit',
    likes: 847,
    date: 'Feb 2026',
    href: '#',
    featured: true,
  },
  // Regular grid cards
  {
    id: 'sp3',
    quote: "Booked through here and my provider was incredible. Checked her license, read 40 reviews, felt completely prepared walking in.",
    author: { name: 'Sarah T.', handle: 'Sarah T.', avatarUrl: 'https://i.pravatar.cc/64?img=32' },
    platform: 'facebook',
    likes: 142,
    date: 'Apr 2026',
    href: '#',
    featured: false,
  },
  {
    id: 'sp4',
    quote: "Six weeks post lip filler and obsessed. My injector was so conservative in the best way. Exactly what I needed.",
    author: { name: 'Priya R.', handle: '@beautydoesbetter', avatarUrl: 'https://i.pravatar.cc/64?img=45' },
    platform: 'instagram',
    likes: 1204,
    date: 'Apr 2026',
    href: '#',
    featured: false,
  },
  {
    id: 'sp5',
    quote: "The treatment guides on this site are the best I've found. Read the whole Botox one the night before my appointment. Went in knowing exactly what to ask.",
    author: { name: 'Jess H.', handle: '@firsttimerbotox', avatarUrl: 'https://i.pravatar.cc/64?img=12' },
    platform: 'x',
    likes: 892,
    date: 'Mar 2026',
    href: '#',
    featured: false,
  },
  {
    id: 'sp6',
    quote: "Always verify your injector's license before any appointment. injectors.world makes it one click. No excuse not to anymore.",
    author: { name: 'safebeauty_r', handle: 'u/safebeauty_r', avatarUrl: 'https://i.pravatar.cc/64?img=56' },
    platform: 'reddit',
    likes: 612,
    date: 'Jan 2026',
    href: '#',
    featured: false,
  },
  {
    id: 'sp7',
    quote: "Found my injector in under 10 minutes. Verified credentials, read real reviews, booked the same day. Could not have been smoother.",
    author: { name: 'Jennifer M.', handle: 'Google review', avatarUrl: 'https://i.pravatar.cc/64?img=38' },
    platform: 'google',
    likes: 0,
    rating: 5,
    date: 'May 2026',
    href: '#',
    featured: false,
  },
  {
    id: 'sp8',
    quote: "As a first-timer the guide on what to expect was everything. Felt so much more confident walking in.",
    author: { name: 'Michelle K.', handle: 'Michelle K.', avatarUrl: 'https://i.pravatar.cc/64?img=25' },
    platform: 'facebook',
    likes: 78,
    date: 'May 2026',
    href: '#',
    featured: false,
  },
]
