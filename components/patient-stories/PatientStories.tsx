import Link from 'next/link'
import type { BeforeAfterRow } from '@/lib/home-queries'
import { PatientStoriesClient } from './PatientStoriesClient'

export function PatientStories({ cases }: { cases: BeforeAfterRow[] }) {
  return (
    <section className="bg-surface-canvas py-16 md:py-24">
      <div className="max-canvas">
        <div className="flex items-end justify-between gap-6 mb-10 md:mb-12 flex-wrap">
          <div className="max-w-[640px]">
            <h2 className="headline-display text-h2-m md:text-h2 text-ink-primary mb-2">Results.</h2>
            <p className="font-serif text-[20px] md:text-[24px] leading-[1.3] text-ink-secondary font-normal">Real patients. Real results.</p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill bg-brand-accent-soft border border-brand-accent/20">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              <span className="text-caption font-semibold text-brand-accent uppercase tracking-wider">All photos shared with patient consent</span>
            </div>
            <Link href="/patient-stories" className="group inline-flex items-center gap-2 text-body-sm font-medium text-brand-accent hover:underline">
              View 6,200+ results
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:translate-x-0.5 transition"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
          </div>
        </div>

        <PatientStoriesClient cases={cases} />
      </div>
    </section>
  )
}
