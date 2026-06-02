export type VideoTile = {
  id: string; platform: 'instagram' | 'tiktok' | 'youtube'
  caption: string; creator: string; thumbnailUrl: string; href: string
  duration: string
}

export const videoTiles: VideoTile[] = [
  { id: 'v1', platform: 'instagram', caption: 'How to spot an overfilled lip', creator: 'Dr. Lena Park, MD', thumbnailUrl: 'https://picsum.photos/seed/video-1/450/800', href: '#', duration: '0:47' },
  { id: 'v2', platform: 'tiktok', caption: 'Masseter Botox in 60 seconds', creator: 'Maya Singh, NP', thumbnailUrl: 'https://picsum.photos/seed/video-2/450/800', href: '#', duration: '1:02' },
  { id: 'v3', platform: 'youtube', caption: 'What 20 units of Botox actually does', creator: 'Dr. Marcus Hill, MD', thumbnailUrl: 'https://picsum.photos/seed/video-3/450/800', href: '#', duration: '0:58' },
  { id: 'v4', platform: 'instagram', caption: 'Three questions to ask before tear trough filler', creator: 'Dr. Rachel Goldman, MD', thumbnailUrl: 'https://picsum.photos/seed/video-4/450/800', href: '#', duration: '0:39' },
  { id: 'v5', platform: 'tiktok', caption: 'Botox vs Dysport, side by side', creator: 'Dr. James Whitaker, DO', thumbnailUrl: 'https://picsum.photos/seed/video-5/450/800', href: '#', duration: '1:11' },
  { id: 'v6', platform: 'youtube', caption: 'Real cost of Botox in NYC, 2026', creator: 'Hannah Reyes, Editor', thumbnailUrl: 'https://picsum.photos/seed/video-6/450/800', href: '#', duration: '2:04' },
  { id: 'v7', platform: 'instagram', caption: 'Sculptra timeline, week by week', creator: 'Dr. Aisha Bello, MD', thumbnailUrl: 'https://picsum.photos/seed/video-7/450/800', href: '#', duration: '0:52' },
  { id: 'v8', platform: 'tiktok', caption: 'Lip flip vs lip filler', creator: 'Sofia Reyes, NP', thumbnailUrl: 'https://picsum.photos/seed/video-8/450/800', href: '#', duration: '0:44' },
]
