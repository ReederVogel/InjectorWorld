import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { DashboardForm, type DashboardFormData, type TreatmentOption } from '@/components/dashboard/DashboardForm'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { getPayloadInstance } from '@/lib/payload-server'

export const metadata: Metadata = {
  title: { absolute: 'Provider dashboard | injector.world' },
  robots: 'noindex',
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const headersList = await headers()
  const payload = await getPayloadInstance()

  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
    redirect('/login?next=/dashboard')
  }

  const role = (user as any).role
  if (role !== 'provider') {
    redirect('/')
  }

  const linkedProvider = (user as any).linkedProvider
  const providerId: number | null =
    linkedProvider == null ? null
    : typeof linkedProvider === 'object' ? linkedProvider.id
    : linkedProvider

  if (!providerId) {
    return (
      <>
        <Header />
        <main className="min-h-[60vh] bg-surface-canvas section-pad">
          <div className="max-canvas max-w-xl">
            <h1 className="font-serif text-h2 text-ink-primary mb-3">Dashboard</h1>
            <div className="rounded-2xl border border-border bg-surface p-6 text-center space-y-4">
              <p className="text-body text-ink-secondary">
                Your account does not have a linked provider profile yet. This happens once an admin approves your claim.
              </p>
              <p className="text-body-sm text-ink-secondary">
                Questions? Email{' '}
                <a href="mailto:support@injector.world" className="text-brand-accent hover:underline">
                  support@injector.world
                </a>
              </p>
              <LogoutButton className="text-body-sm text-ink-secondary hover:text-ink-primary transition">
                Sign out
              </LogoutButton>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  // Fetch the provider record
  let provider: any = null
  try {
    provider = await payload.findByID({
      collection: 'providers',
      id: providerId,
      depth: 1,
      overrideAccess: true,
    })
  } catch {
    redirect('/')
  }

  if (!provider) redirect('/')

  // Fetch available treatments for the multi-select
  const treatmentsRes = await payload.find({
    collection: 'treatments',
    limit: 100,
    depth: 0,
    sort: 'name',
  })
  const treatmentOptions: TreatmentOption[] = treatmentsRes.docs.map((t: any) => ({
    id: String(t.id),
    name: t.name,
  }))

  // Current treatment IDs (as strings for the form)
  const currentTreatmentIds: string[] = Array.isArray(provider.treatmentsOffered)
    ? provider.treatmentsOffered.map((t: any) =>
        String(typeof t === 'object' ? t.id : t),
      )
    : []

  const initial: DashboardFormData = {
    tagline: provider.tagline || '',
    bio: provider.bio || '',
    profilePhotoUrl: provider.profilePhotoUrl || '',
    languages: Array.isArray(provider.languages) ? provider.languages : [],
    treatmentsOffered: currentTreatmentIds,
    pricingBotoxPerUnit: provider.pricingBotoxPerUnit ?? null,
    pricingFillerPerSyringe: provider.pricingFillerPerSyringe ?? null,
    pricingConsultation: provider.pricingConsultation ?? null,
    startingPrice: provider.startingPrice ?? null,
    acceptsNewPatients: !!provider.acceptsNewPatients,
    offersVirtualConsult: !!provider.offersVirtualConsult,
    offersInPerson: !!provider.offersInPerson,
    websiteUrl: provider.websiteUrl || '',
    email: provider.email || '',
    phoneDirect: provider.phoneDirect || '',
    instagramUrl: provider.instagramUrl || '',
    tiktokUrl: provider.tiktokUrl || '',
    linkedinUrl: provider.linkedinUrl || '',
  }

  const providerName = provider.fullName || 'Your profile'

  return (
    <>
      <Header />

      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-caption text-ink-tertiary uppercase tracking-wider font-semibold mb-0.5">
              Provider dashboard
            </p>
            <h1 className="font-serif text-h3 text-ink-primary">{providerName}</h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              href={`/injectors/${provider.slug}`}
              target="_blank"
              className="text-body-sm text-brand-accent hover:underline flex items-center gap-1"
            >
              View public profile
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
            <LogoutButton className="text-body-sm text-ink-secondary hover:text-ink-primary transition">
              Sign out
            </LogoutButton>
          </div>
        </div>
      </div>

      <main className="bg-surface-canvas section-pad">
        <div className="max-canvas max-w-3xl">
          {/* Read-only identity block */}
          <div className="rounded-2xl border border-border bg-surface p-5 mb-10 flex flex-wrap gap-5 items-start">
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-body-sm font-medium text-ink-primary">{provider.fullName}</p>
              <p className="text-body-sm text-ink-secondary">{provider.title} · {provider.credentials}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 bg-brand-accent-soft text-brand-accent text-[11px] font-semibold px-3 py-1 rounded-pill">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                License verified
              </span>
              {provider.claimed && (
                <span className="inline-flex items-center gap-1.5 bg-surface border border-border text-ink-secondary text-[11px] font-semibold px-3 py-1 rounded-pill">
                  Profile claimed
                </span>
              )}
            </div>
          </div>

          <DashboardForm
            initial={initial}
            treatmentOptions={treatmentOptions}
            providerName={providerName}
          />
        </div>
      </main>

      <Footer />
    </>
  )
}
