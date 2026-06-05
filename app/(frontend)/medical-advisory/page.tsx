import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { getPayloadInstance } from '@/lib/payload-server'

export const revalidate = 300

export const metadata: Metadata = {
  title: { absolute: 'Medical Advisory Board | injector.world' },
  description: 'The board-certified physicians who review and approve all medical content on injector.world.',
  alternates: { canonical: 'https://injector.world/medical-advisory' },
}

export default async function MedicalAdvisoryPage() {
  let reviewers: any[] = []
  try {
    const payload = await getPayloadInstance()
    const res = await payload.find({
      collection: 'medical-reviewers',
      limit: 50,
      sort: '-reviewedCount',
      depth: 0,
    })
    reviewers = res.docs as any[]
  } catch {
    // DB unavailable at build time — revalidates at runtime
  }

  return (
    <>
      <Header />

      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <span className="text-ink-primary">Medical advisory board</span>
          </nav>
        </div>
      </div>

      <section className="bg-surface-warm pt-12 pb-10">
        <div className="max-canvas max-w-3xl">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-4 block">
            Medical oversight
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-4">
            Medical advisory board
          </h1>
          <p className="font-serif text-lede-m md:text-lede text-ink-secondary">
            Board-certified physicians who review all treatment guides and medical content on injector.world before publication.
          </p>
        </div>
      </section>

      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {reviewers.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-surface p-6">
                <div className="flex items-start gap-4 mb-4">
                  {r.photoUrl ? (
                    <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0 border-2 border-brand-accent">
                      <Image src={r.photoUrl} alt={r.fullName} fill sizes="64px" className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-brand-accent-soft border-2 border-brand-accent flex items-center justify-center flex-shrink-0">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="1.5">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-body text-ink-primary">{r.fullName}</div>
                    <div className="text-body-sm text-ink-secondary mt-0.5">{r.title}</div>
                    {r.city && r.state && (
                      <div className="text-caption text-ink-tertiary mt-0.5">{r.city}, {r.state}</div>
                    )}
                  </div>
                </div>

                {r.bio && (
                  <p className="text-body-sm text-ink-secondary leading-relaxed mb-4">{r.bio}</p>
                )}

                {Array.isArray(r.boardCertifications) && r.boardCertifications.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {r.boardCertifications.map((cert: any) => (
                      <span key={cert.name} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-pill bg-brand-accent-soft text-brand-accent">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                        {cert.name}
                      </span>
                    ))}
                  </div>
                )}

                {r.reviewedCount > 0 && (
                  <div className="text-caption text-ink-tertiary">
                    {r.reviewedCount} articles reviewed
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-surface p-8">
            <h2 className="font-serif text-h2 text-ink-primary mb-4">How medical review works</h2>
            <p className="text-body text-ink-secondary leading-relaxed mb-4">
              Every treatment guide and medical article on injector.world is reviewed by at least one member of this board before publication. Reviewers check for clinical accuracy, completeness of risk disclosures, and alignment with current guidelines.
            </p>
            <p className="text-body text-ink-secondary leading-relaxed">
              Reviewers are independent from the editorial team and have no commercial relationship with injector.world. Their names, credentials, and review dates appear on every article they review.
            </p>
            <Link href="/editorial-standards" className="inline-flex items-center gap-1.5 mt-5 text-body-sm text-brand-accent font-medium hover:underline">
              Read our editorial standards
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
