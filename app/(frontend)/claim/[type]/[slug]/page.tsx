import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ClaimForm } from '@/components/auth/ClaimForm'
import { getPayloadInstance } from '@/lib/payload-server'
import { verifyOutreachInviteToken } from '@/lib/outreach'
import { formatPhoneDisplay } from '@/lib/format-phone'

export const metadata: Metadata = {
  title: { absolute: 'Claim this profile | injector.world' },
  robots: 'noindex',
}

type Params = { type: string; slug: string }

export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<{ inv?: string }>
}) {
  const { type, slug } = await params
  const { inv } = await searchParams

  if (type !== 'clinic') notFound()

  const payload = await getPayloadInstance()
  const collection = 'clinics' as const

  const res = await payload.find({
    collection,
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const doc = res.docs[0] as any
  if (!doc) notFound()

  const support = (
    <a href={`mailto:support@injector.world?subject=${encodeURIComponent(`Claim: ${doc.clinicName}`)}`} className="text-brand-accent hover:underline">
      support@injector.world
    </a>
  )

  // Only a live listing can be claimed online. Hidden (not an injector clinic),
  // draft and in-review listings are off the site; the API refuses them too.
  if (doc.status !== 'published') {
    return (
      <ClaimNotice title="This listing cannot be claimed online">
        It is not live on injector.world right now. If this is your clinic, email {support} and we will help you set it up.
      </ClaimNotice>
    )
  }

  if (doc.claimed) {
    return (
      <ClaimNotice
        title="This profile is already claimed"
        badge={
          <span className="inline-flex items-center gap-1.5 bg-brand-accent-soft text-brand-accent text-[11px] font-semibold px-3 py-1 rounded-control mb-4">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            Claimed
          </span>
        }
      >
        {/* Owners often come back through their claim link after approval. */}
        If this is your clinic,{' '}
        <a href="/login?next=/dashboard/clinic" className="text-brand-accent hover:underline">sign in to your dashboard</a>. If you believe it was claimed in error, contact {support}.
      </ClaimNotice>
    )
  }

  const targetName = doc.clinicName

  // Invite link (?inv=<id>.<sig>): prefill the recipient's email from the
  // ClaimInvite record. The token is HMAC-signed and the invite must point at
  // THIS clinic, so a link can never leak someone else's address.
  let inviteEmail = ''
  if (inv && type === 'clinic') {
    const inviteId = verifyOutreachInviteToken(inv)
    if (inviteId) {
      try {
        const invite = await payload.findByID({
          collection: 'claim-invites',
          id: inviteId,
          depth: 0,
          overrideAccess: true,
        }) as any
        const targetId = typeof invite?.targetClinic === 'object' ? invite?.targetClinic?.id : invite?.targetClinic
        if (invite && String(targetId) === String(doc.id) && invite.status !== 'unsubscribed') {
          inviteEmail = invite.email || ''
        }
      } catch { /* bad or deleted invite — form just starts empty */ }
    }
  }

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
            Is this your clinic? Submit your details below. Our team will verify your credentials within 2 to 3 business days and link this profile to your account.
          </p>

          <div className="rounded-2xl border border-border bg-surface p-6 md:p-8">
            <ClaimForm
              claimType='clinic'
              targetId={String(doc.id)}
              targetName={targetName}
              initialEmail={inviteEmail}
              // Every claim link, invite or not: phone and website are already public on the profile.
              // Email stays invite-only, since a scraped email is never public before a claim.
              initialPhone={formatPhoneDisplay(doc.phone) || ''}
              // shortcut: assumes the site serves https; upgrade the stored urls in the DB to drop this.
              initialWebsite={(doc.websiteUrl || '').replace(/^http:\/\//i, 'https://')}
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

/** Full-page message used instead of the claim form (already claimed, not live). */
function ClaimNotice({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-[60vh] bg-surface-canvas section-pad">
        <div className="max-canvas max-w-md text-center">
          {badge}
          <h1 className="font-serif text-h2 text-ink-primary mb-3">{title}</h1>
          <p className="text-body text-ink-secondary mb-6">{children}</p>
        </div>
      </main>
      <Footer />
    </>
  )
}
