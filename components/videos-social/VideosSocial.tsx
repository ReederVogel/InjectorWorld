import Link from 'next/link'
import { VideoGrid } from './VideoGrid'
import { SocialPostsClient } from './SocialPostsClient'
import { getPayloadInstance } from '@/lib/payload-server'
import { videoTiles } from '@/lib/videos-data'
import { socialPosts as staticSocialPosts } from '@/lib/social-posts-data'
import type { VideoTile } from '@/lib/videos-data'
import type { SocialPost } from '@/lib/social-posts-data'

export async function VideosSocial() {
  const payload = await getPayloadInstance()

  // Fetch video testimonials — only render if real data exists (no placeholder fallback).
  let videos: VideoTile[] = []
  try {
    const vtRes = await payload.find({
      collection: 'video-testimonials',
      limit: 8,
      where: { active: { equals: true } },
      sort: 'sortRank',
      depth: 0,
    })
    if (vtRes.docs.length > 0) {
      videos = vtRes.docs.map((v: any) => ({
        id: String(v.id),
        platform: v.platform,
        caption: v.caption,
        creator: v.creator,
        thumbnailUrl: typeof v.thumbnail === 'object' ? (v.thumbnail?.url ?? '') : (v.thumbnail ?? ''),
        href: v.href,
        duration: v.duration,
      }))
    }
  } catch (_) {}

  // Fetch social posts — only render if real data exists.
  let posts: SocialPost[] = []
  try {
    const spRes = await payload.find({
      collection: 'social-posts',
      limit: 50,
      where: { active: { equals: true } },
      sort: 'sortRank',
      depth: 0,
    })
    if (spRes.docs.length > 0) {
      posts = spRes.docs.map((p: any) => ({
        id: String(p.id),
        platform: p.platform,
        quote: p.quote,
        author: {
          name: p.author,
          handle: p.handle,
          avatarUrl: typeof p.avatar === 'object' ? (p.avatar?.url ?? 'https://i.pravatar.cc/64') : 'https://i.pravatar.cc/64',
        },
        likes: p.likes ?? 0,
        rating: p.rating ?? undefined,
        date: p.date,
        href: p.href || '#',
        featured: !!p.featured,
      }))
    }
  } catch (_) {}

  // Don't render the section if there's no real content
  if (videos.length === 0 && posts.length === 0) return null

  return (
    <section className="bg-surface section-pad-tight border-t border-border-subtle">
      <div className="max-canvas">
        <div className="flex items-end justify-between gap-6 mb-10 md:mb-12 flex-wrap">
          <div className="max-w-[640px]">
            <h2 className="headline-display text-h2-m md:text-h2 text-ink-primary mb-2">On video.</h2>
            <p className="font-serif text-[20px] md:text-[24px] leading-[1.3] text-ink-secondary font-normal">In their own words.</p>
          </div>
          <Link href="/videos" className="group inline-flex items-center gap-2 text-body-sm font-medium text-brand-accent hover:underline">
            See all videos
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:translate-x-0.5 transition" aria-hidden>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>

        <VideoGrid videos={videos} />

        {/* Written posts row */}
        <div className="mt-16 md:mt-20 pt-16 md:pt-20 border-t border-border-subtle">
          <div className="flex items-end justify-between gap-6 mb-10 md:mb-12 flex-wrap">
            <div className="max-w-[640px]">
              <h3 className="font-serif text-[28px] md:text-[32px] leading-[1.1] font-medium mb-2 text-ink-primary tracking-tight">
                What they&rsquo;re saying.
              </h3>
              <p className="font-serif text-[18px] md:text-[20px] leading-[1.4] text-ink-secondary font-normal">
                Across the internet.
              </p>
            </div>
          </div>
          <SocialPostsClient posts={posts} preview />
        </div>
      </div>
    </section>
  )
}
