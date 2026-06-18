import type { Metadata } from 'next'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { VideoGrid } from '@/components/videos-social/VideoGrid'
import { getPayloadInstance } from '@/lib/payload-server'
import { videoTiles } from '@/lib/videos-data'
import type { VideoTile } from '@/lib/videos-data'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Videos | injector.world',
  description: 'Watch injectors and patients share their experiences with Botox, filler, and aesthetic treatments.',
}

export default async function VideosPage() {
  const payload = await getPayloadInstance()
  let videos: VideoTile[] = videoTiles

  try {
    const res = await payload.find({
      collection: 'video-testimonials',
      limit: 100,
      where: { active: { equals: true } },
      sort: 'sortRank',
      depth: 0,
    })
    if (res.docs.length > 0) {
      videos = res.docs.map((v: any) => ({
        id: String(v.id),
        platform: v.platform,
        caption: v.caption,
        creator: v.creator,
        thumbnailUrl: v.thumbnailUrl,
        href: v.href,
        duration: v.duration,
      }))
    }
  } catch (_) {}

  return (
    <>
      <Header />
      <main>
        <section className="bg-surface-canvas py-16 md:py-24">
          <div className="max-canvas">
            <div className="mb-10 md:mb-14">
              <p className="text-overline text-brand-accent mb-3">On video</p>
              <h1 className="headline-display text-h1-m md:text-h1 text-ink-primary mb-4">In their own words.</h1>
              <p className="font-serif text-[19px] md:text-[22px] leading-[1.4] text-ink-secondary max-w-[560px]">
                Injectors and patients share their stories directly.
              </p>
            </div>

            {videos.length > 0 ? (
              <VideoGrid videos={videos} />
            ) : (
              <div className="text-center py-24 text-ink-tertiary">
                <p className="text-body">No videos published yet. Check back soon.</p>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
