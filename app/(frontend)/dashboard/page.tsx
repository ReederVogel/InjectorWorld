import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { DashboardForm, type DashboardFormData, type TreatmentOption } from '@/components/dashboard/DashboardForm'
import { DashboardLocations, type LocationOption } from '@/components/dashboard/DashboardLocations'
import { ClinicPhotosUpload, type ClinicPhoto } from '@/components/dashboard/PhotoUpload'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { getPayloadInstance } from '@/lib/payload-server'
import { getAuthUser } from '@/lib/auth-user'
import { getBrandForClinic } from '@/lib/brand-queries'
import { limits, TIER_LABELS, type Tier } from '@/lib/entitlements'
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist'

export const metadata: Metadata = {
  title: { absolute: 'Provider dashboard | injector.world' },
  robots: 'noindex',
}

export const dynamic = 'force-dynamic'

function relId(rel: unknown): number | null {
  if (rel == null) return null
  if (typeof rel === 'object') return Number((rel as { id?: number | string }).id)
  return Number(rel)
}

export default async function DashboardPage() {
  const payload = await getPayloadInstance()

  const user = await getAuthUser(payload)
  if (!user) {
    redirect('/login?next=/dashboard')
  }

  const role = (user as any).role
  if (role !== 'provider') {
    redirect('/')
  }

  const providerId = relId((user as any).linkedProvider)
  const clinicId = relId((user as any).linkedClinic)

  // No linked profile of either kind yet (awaiting claim approval).
  if (!providerId && !clinicId) {
    return (
      <>
        <Header />
        <main className="min-h-[60vh] bg-surface-canvas section-pad">
          <div className="max-canvas max-w-xl">
            <h1 className="font-serif text-h2 text-ink-primary mb-3">Dashboard</h1>
            <div className="rounded-2xl border border-border bg-surface p-6 text-center space-y-4">
              <p className="text-body text-ink-secondary">
                Your account does not have a linked profile yet. This happens once an admin approves your claim.
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

  // ── Provider data (only when a provider profile is linked) ─────────────────
  let provider: any = null
  let initial: DashboardFormData | null = null
  let initialPhotoUrl = ''
  let treatmentOptions: TreatmentOption[] = []
  let primaryClinic: { name: string; city: string; state: string; slug: string } | null = null
  let initialAdditional: LocationOption[] = []
  let brandName: string | undefined
  let brandSlug: string | undefined
  let brandSiblings: LocationOption[] = []
  let providerTier: Tier = 'free'
  let profileViewCount = 0

  if (providerId) {
    try {
      provider = await payload.findByID({ collection: 'providers', id: providerId, depth: 1, overrideAccess: true })
    } catch {
      provider = null
    }

    if (provider) {
      providerTier = (provider.subscriptionTier as Tier) || 'free'
      profileViewCount = provider.profileViewCount || 0

      const treatmentsRes = await payload.find({ collection: 'treatments', limit: 100, depth: 0, sort: 'name' })
      treatmentOptions = treatmentsRes.docs.map((t: any) => ({ id: String(t.id), name: t.name }))

      const currentTreatmentIds: string[] = Array.isArray(provider.treatmentsOffered)
        ? provider.treatmentsOffered.map((t: any) => String(typeof t === 'object' ? t.id : t))
        : []

      initialPhotoUrl = provider.profilePhotoUrl || ''
      initial = {
        tagline: provider.tagline || '',
        bio: provider.bio || '',
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

      const primaryClinicObj = provider.clinic && typeof provider.clinic === 'object' ? provider.clinic : null
      primaryClinic = primaryClinicObj
        ? {
            name: primaryClinicObj.clinicName as string,
            city: primaryClinicObj.city as string,
            state: primaryClinicObj.state as string,
            slug: primaryClinicObj.slug as string,
          }
        : null

      initialAdditional = Array.isArray(provider.additionalClinics)
        ? provider.additionalClinics
            .filter((c: any) => c && typeof c === 'object')
            .map((c: any) => ({ id: Number(c.id), clinicName: c.clinicName, city: c.city, state: c.state }))
        : []

      if (primaryClinicObj) {
        const brand = await getBrandForClinic((primaryClinicObj as any).brand, String(primaryClinicObj.id))
        if (brand) {
          brandName = brand.name
          brandSlug = brand.slug
          brandSiblings = brand.otherLocations.map((l) => ({
            id: Number(l.id),
            clinicName: l.clinicName,
            city: l.city,
            state: l.state,
          }))
        }
      }
    }
  }

  // ── Clinic data (only when a clinic is linked) ─────────────────────────────
  // Booking (lead) count for the analytics section
  let bookingCount = 0
  if (providerId) {
    try {
      const bRes = await payload.find({
        collection: 'bookings',
        where: { provider: { equals: providerId } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      })
      bookingCount = bRes.totalDocs
    } catch {
      // best-effort
    }
  }

  let clinic: any = null
  let clinicPhotos: ClinicPhoto[] = []
  if (clinicId) {
    try {
      clinic = await payload.findByID({ collection: 'clinics', id: clinicId, depth: 1, overrideAccess: true })
    } catch {
      clinic = null
    }
    if (clinic) {
      clinicPhotos = (Array.isArray(clinic.photos) ? clinic.photos : [])
        .filter((m: any) => m && typeof m === 'object' && m.url)
        .map((m: any) => ({ id: Number(m.id), url: m.url as string }))
    }
  }

  const heading = provider?.fullName || clinic?.clinicName || 'Your dashboard'
  const publicHref = provider?.slug
    ? `/injectors/${provider.slug}`
    : clinic?.slug
      ? `/clinics/${clinic.slug}`
      : null

  return (
    <>
      <Header />

      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-caption text-ink-tertiary uppercase tracking-wider font-semibold mb-0.5">
              {provider ? 'Provider dashboard' : 'Clinic dashboard'}
            </p>
            <h1 className="font-serif text-h3 text-ink-primary">{heading}</h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {publicHref && (
              <Link
                href={publicHref}
                target="_blank"
                className="text-body-sm text-brand-accent hover:underline flex items-center gap-1"
              >
                View public profile
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
              </Link>
            )}
            <LogoutButton className="text-body-sm text-ink-secondary hover:text-ink-primary transition">
              Sign out
            </LogoutButton>
          </div>
        </div>
      </div>

      <main className="bg-surface-canvas section-pad">
        <div className="max-canvas max-w-3xl space-y-14">

          {provider && initial && (
            <section>
              {/* Onboarding checklist — hides itself once all steps are done */}
              <OnboardingChecklist
                hasPhoto={!!initialPhotoUrl}
                hasBio={!!initial.bio?.trim()}
                hasTreatments={(initial.treatmentsOffered?.length ?? 0) > 0}
                hasPrice={!!initial.startingPrice}
                hasClinic={!!primaryClinic}
              />

              {/* Plan + analytics banner */}
              <TierBanner
                tier={providerTier}
                profileViewCount={profileViewCount}
                bookingCount={bookingCount}
              />

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
                initialPhotoUrl={initialPhotoUrl}
                treatmentOptions={treatmentOptions}
                providerName={provider.fullName || 'Your profile'}
                tier={providerTier}
              />

              <div className="mt-14 pt-10 border-t border-border">
                <DashboardLocations
                  primaryClinic={primaryClinic}
                  brandName={brandName}
                  brandSlug={brandSlug}
                  initialAdditional={initialAdditional}
                  brandSiblings={brandSiblings}
                />
              </div>
            </section>
          )}

          {clinic && (
            <section className={provider ? 'pt-14 border-t border-border' : ''}>
              <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3 mb-2">
                {provider ? `Clinic photos — ${clinic.clinicName}` : 'Clinic photos'}
              </h2>
              <p className="text-body-sm text-ink-secondary mb-6">
                Upload photos of {clinic.clinicName}. These appear on your clinic page and listings.
              </p>
              <ClinicPhotosUpload initial={clinicPhotos} maxPhotos={limits(providerTier).maxPhotos} />
            </section>
          )}

        </div>
      </main>

      <Footer />
    </>
  )
}

// ─── Tier banner (server component, no interactivity needed) ────────────────

const TIER_COLOR: Record<Tier, string> = {
  free: 'bg-surface border-border',
  starter: 'bg-surface border-brand-accent/30',
  pro: 'bg-brand-accent-soft border-brand-accent/40',
  elite: 'bg-[#FAF5FF] border-[#7C3AED]/20 dark:bg-surface dark:border-[#7C3AED]/20',
}

const TIER_BADGE: Record<Tier, string> = {
  free: 'bg-surface border border-border text-ink-secondary',
  starter: 'bg-brand-accent-soft text-brand-accent',
  pro: 'bg-brand-primary text-surface-canvas',
  elite: 'bg-[#7C3AED] text-white',
}

function TierBanner({
  tier,
  profileViewCount,
  bookingCount,
}: {
  tier: Tier
  profileViewCount: number
  bookingCount: number
}) {
  const tierLimits = limits(tier)
  const showAnalytics = tierLimits.analytics !== 'none'
  const showFull = tierLimits.analytics === 'full'
  const isUpgradeable = tier !== 'elite'

  return (
    <div className={`rounded-2xl border p-5 mb-10 ${TIER_COLOR[tier]}`}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-pill ${TIER_BADGE[tier]}`}>
            {TIER_LABELS[tier]} plan
          </span>
          {tier === 'free' && (
            <span className="text-body-sm text-ink-secondary">
              Verification and organic ranking included. Always.
            </span>
          )}
        </div>
        {isUpgradeable && (
          <a
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-brand-accent hover:underline"
          >
            Upgrade plan
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
          </a>
        )}
      </div>

      {showAnalytics ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface/80 border border-border p-4">
            <p className="text-caption text-ink-tertiary mb-0.5 font-medium uppercase tracking-wider">Profile views</p>
            <p className="font-serif text-[1.75rem] leading-tight font-medium text-ink-primary">{profileViewCount.toLocaleString()}</p>
            <p className="text-caption text-ink-tertiary mt-0.5">All time</p>
          </div>
          <div className="rounded-xl bg-surface/80 border border-border p-4">
            <p className="text-caption text-ink-tertiary mb-0.5 font-medium uppercase tracking-wider">Lead requests</p>
            <p className="font-serif text-[1.75rem] leading-tight font-medium text-ink-primary">{bookingCount.toLocaleString()}</p>
            <p className="text-caption text-ink-tertiary mt-0.5">Via injector.world</p>
          </div>
          {showFull && (
            <div className="col-span-2 rounded-xl bg-surface/80 border border-border p-4">
              <p className="text-caption text-ink-tertiary mb-1 font-medium uppercase tracking-wider">Referrer breakdown</p>
              <p className="text-body-sm text-ink-secondary">Full referrer analytics are being collected and will appear here once enough data has accumulated.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 text-body-sm text-ink-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-tertiary flex-shrink-0">
            <path d="M3 3v18h18" /><path d="M18 9l-5 5-2-2-4 4" />
          </svg>
          <span>
            Profile view analytics and lead counts are available on the{' '}
            <a href="/pricing" className="text-brand-accent hover:underline font-medium">Pro plan</a>.
          </span>
        </div>
      )}
    </div>
  )
}
