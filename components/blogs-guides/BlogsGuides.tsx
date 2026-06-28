import Link from 'next/link'
import type { GuideRow } from '@/lib/home-queries'
import { BlogsGuidesClient } from './BlogsGuidesClient'

export function BlogsGuides({ guides }: { guides: GuideRow[] }) {
  return (
    <section className="bg-surface-warm py-16 md:py-24">
      <div className="max-canvas">
        <div className="flex items-end justify-between gap-6 mb-8 md:mb-10 flex-wrap">
          <div>
            <h2 className="font-serif text-h2-m md:text-h2 text-ink-primary mb-1">Guides</h2>
            <p className="text-body text-ink-secondary">Read before you book.</p>
          </div>
          <Link
            href="/guides"
            className="hidden sm:flex items-center gap-1.5 text-body-sm font-medium text-brand-accent hover:underline flex-shrink-0"
          >
            All guides
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>

        <BlogsGuidesClient guides={guides} />
      </div>
    </section>
  )
}
