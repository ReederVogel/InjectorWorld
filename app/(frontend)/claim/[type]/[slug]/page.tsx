import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ClaimForm } from '@/components/auth/ClaimForm'
import { getPayloadInstance } from '@/lib/payload-server'

export const metadata: Metadata = {
  title: { absolute: 'Claim this profile | injector.world' },
  robots: 'noindex',
}

type Params = { type: string; slug: string }

export default async function ClaimPage({ params }: { params: Promise<Params> }) {
  const { type, slug } = await params

  if (type !== 'provider' && type !== 'clinic') notFound()

  const payload = await getPayloadInstance()
  const collection = type === 'provider' ? 'providers' : 'clinics'

  const res = await payload.find({
    collection,
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const doc = res.docs[0] as any
  if (!doc) notFound()

  if (doc.claimed) {
    return (
      <>
        <Header />
        <main className="min-h-[60vh] bg-surface-canvas section-pad">
          <div className="max-canvas max-w-md text-center">
            <span className="inline-flex items-center gap-1.5 bg-brand-accent-soft text-brand-accent text-[11px] font-semibold px-3 py-1 rounded-pill mb-4">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              Claimed
            </span>
            <h1 className="font-serif text-h2 text-ink-primary mb-3">This profile is already claimed</h1>
            <p className="text-body text-ink-secondary mb-6">
              This {type === 'provider' ? 'provider profile' : 'clinic'} has already been claimed by its owner. If you believe this is an error, contact{' '}
              <a href="mailto:support@injector.world" className="text-brand-accent hover:underline">
                support@injector.world
              </a>
              .
            </p>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  const targetName = type === 'provider' ? doc.fullName : doc.clinicName

  return (
    <>
      <Header />

      <main className="min-h-[60vh] bg-surface-canvas section-pad">
        <div className="max-canvas max-w-xl">
          <p className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3 block">
            Claim this profile
          </p>
          <h1 className="font-serif text-h2 text-ink-primary mb-2">
            {targetName}
          </h1>
          <p className="text-body text-ink-secondary mb-8">
            Is this your {type === 'provider' ? 'profile' : 'clinic'}? Submit your details below. Our team will verify your credentials within 2 to 3 business days and link this profile to your account.
          </p>

          <div className="rounded-2xl border border-border bg-surface p-6 md:p-8">
            <ClaimForm
              claimType={type as 'provider' | 'clinic'}
              targetId={String(doc.id)}
              targetName={targetName}
            />
          </div>

          <div className="mt-6 rounded-xl border border-border-subtle bg-surface p-4 text-body-sm text-ink-secondary space-y-1.5">
            <p className="font-medium text-ink-primary">What happens next?</p>
            <p>Our team checks your license against the state board and verifies your identity.</p>
            <p>Once approved, your account will be linked to this profile and you can edit your bio, pricing, and contact details.</p>
            <p>You will not be able to edit your license number, verified badge, or patient reviews.</p>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
