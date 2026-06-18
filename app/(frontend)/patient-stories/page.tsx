import type { Metadata } from 'next'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { PatientStoriesClient } from '@/components/patient-stories/PatientStoriesClient'
import { getPayloadInstance } from '@/lib/payload-server'
import type { BeforeAfterRow } from '@/lib/home-queries'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Patient Results | injector.world',
  description: 'Real before and after results from verified aesthetic injectors across the United States. All photos shared with patient consent.',
}

export default async function PatientStoriesPage() {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'before-after-cases',
    limit: 48,
    depth: 1,
    sort: 'sortRank',
    where: { consentGranted: { equals: true } },
  })

  const cases: BeforeAfterRow[] = res.docs.map((b: any) => ({
    id: String(b.id),
    caseTitle: b.caseTitle,
    beforePhotoUrl: b.beforePhotoUrl,
    afterPhotoUrl: b.afterPhotoUrl,
    treatmentTag: b.treatmentTag,
    weeksPost: b.weeksPost,
    city: b.city,
    state: b.state,
    provider: b.provider && typeof b.provider === 'object'
      ? { fullName: b.provider.fullName, slug: b.provider.slug }
      : undefined,
    consentGranted: !!b.consentGranted,
  }))

  return (
    <>
      <Header />
      <main>
        <section className="bg-surface-canvas py-16 md:py-24">
          <div className="max-canvas">
            <div className="flex items-start md:items-end justify-between gap-6 mb-10 md:mb-14 flex-wrap">
              <div className="max-w-[640px]">
                <p className="text-overline text-brand-accent mb-3">Results</p>
                <h1 className="headline-display text-h1-m md:text-h1 text-ink-primary mb-4">Real patients. Real results.</h1>
                <p className="font-serif text-[19px] md:text-[22px] leading-[1.4] text-ink-secondary">
                  Before and after cases from verified injectors across the US. Every photo shared with patient consent.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill bg-brand-accent-soft border border-brand-accent/20 flex-shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="3" aria-hidden>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-caption font-semibold text-brand-accent uppercase tracking-wider">Consent verified</span>
              </div>
            </div>

            {cases.length > 0 ? (
              <PatientStoriesClient cases={cases} />
            ) : (
              <div className="text-center py-24 text-ink-tertiary">
                <p className="text-body">No results published yet. Check back soon.</p>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
