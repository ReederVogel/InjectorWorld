import type { GuideRow } from '@/lib/home-queries'
import { BlogsGuidesClient } from './BlogsGuidesClient'

export function BlogsGuides({ guides }: { guides: GuideRow[] }) {
  return (
    <section className="bg-surface-warm py-16 md:py-24">
      <div className="max-canvas">
        <div className="max-w-[640px] mb-8 md:mb-10">
          <h2 className="headline-display text-h2-m md:text-h2 text-ink-primary mb-2">Editorial.</h2>
          <p className="font-serif text-[20px] md:text-[24px] leading-[1.3] text-ink-secondary font-normal">Read before you book.</p>
        </div>

        <BlogsGuidesClient guides={guides} />
      </div>
    </section>
  )
}
