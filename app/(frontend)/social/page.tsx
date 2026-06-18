import type { Metadata } from 'next'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { SocialPostsClient } from '@/components/videos-social/SocialPostsClient'
import { getPayloadInstance } from '@/lib/payload-server'
import { socialPosts as staticSocialPosts } from '@/lib/social-posts-data'
import type { SocialPost } from '@/lib/social-posts-data'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Patient Reviews | injector.world',
  description: 'See what patients are saying about their injectors across social media and review platforms.',
}

export default async function SocialPage() {
  const payload = await getPayloadInstance()
  let posts: SocialPost[] = staticSocialPosts

  try {
    const res = await payload.find({
      collection: 'social-posts',
      limit: 100,
      where: { active: { equals: true } },
      sort: 'sortRank',
      depth: 0,
    })
    if (res.docs.length > 0) {
      posts = res.docs.map((p: any) => ({
        id: String(p.id),
        platform: p.platform,
        quote: p.quote,
        author: {
          name: p.author,
          handle: p.handle,
          avatarUrl: p.avatarUrl || 'https://i.pravatar.cc/64',
        },
        likes: p.likes ?? 0,
        rating: p.rating ?? undefined,
        date: p.date,
        href: p.href || '#',
        featured: !!p.featured,
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
              <p className="text-overline text-brand-accent mb-3">Reviews</p>
              <h1 className="headline-display text-h1-m md:text-h1 text-ink-primary mb-4">What they&rsquo;re saying.</h1>
              <p className="font-serif text-[19px] md:text-[22px] leading-[1.4] text-ink-secondary max-w-[560px]">
                Real patients across social media and review platforms.
              </p>
            </div>

            <SocialPostsClient posts={posts} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
