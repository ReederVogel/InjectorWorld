import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { getPayloadInstance } from '@/lib/payload-server'
import { getAuthUser } from '@/lib/auth-user'
import { getLocationSlugMap, lookupSlugs } from '@/lib/location-slug-lookup'
import { ANALYTICS_DAYS, can, effectiveTier, limits, STATUS_LABELS, TIER_LABELS, type SubscriptionStatus, type Tier } from '@/lib/entitlements'
import { clinicAnalytics } from '@/lib/clinic-analytics'
import { ClinicAnalyticsPanel } from '@/components/dashboard/ClinicAnalyticsPanel'
import { LeadsList } from '@/components/dashboard/LeadsList'
import { toOwnerLead, type OwnerLead } from '@/lib/owner-leads'
import { BeforeAfterManager } from '@/components/dashboard/BeforeAfterManager'
import { MAX_BEFORE_AFTER, toOwnerCase } from '@/lib/before-after'
import { ProtectedEmail } from '@/components/shared/ProtectedEmail'
import { ClinicProfileForm, type ClinicFormData, type RelOption } from '@/components/dashboard/ClinicProfileForm'
import type { ClinicPhoto } from '@/components/dashboard/PhotoUpload'
import { ClinicOnboardingChecklist } from '@/components/dashboard/ClinicOnboardingChecklist'
import { computeClinicCompleteness } from '@/lib/clinic-completeness'
import { ownedClinics } from '@/lib/owned-clinics'

export const metadata: Metadata = {
  title: { absolute: 'Clinic dashboard | injector.world' },
  robots: 'noindex',
}

export const dynamic = 'force-dynamic'

export default async function ClinicDashboardPage({ searchParams }: { searchParams: Promise<{ clinic?: string }> }) {
  const payload = await getPayloadInstance()
  const user = await getAuthUser(payload)

  if (!user) redirect('/login?next=/dashboard/clinic')

  const role = (user as any).role
  if (role === 'user') redirect('/dashboard')
  if (role === 'brand') redirect('/dashboard/brand')
  if (role === 'admin' || role === 'editor') redirect('/admin')
  if (role !== 'clinic') redirect('/')

  // An owner can run several clinics; ?clinic= picks one (default: the first).
  const { clinic: requested } = await searchParams
  const owned = await ownedClinics(payload, user)
  if (requested && !owned.some((c) => c.id === Number(requested))) redirect('/dashboard/clinic')
  const clinicId = requested ? Number(requested) : owned[0]?.id ?? null

  if (!clinicId) {
    return (
      <>
        <Header />
        <main className="min-h-[60vh] bg-surface-canvas section-pad">
          <div className="max-canvas max-w-xl">
            <h1 className="font-serif text-h2 text-ink-primary mb-3">Clinic dashboard</h1>
            <div className="rounded-2xl border border-border bg-surface p-6 text-center space-y-4">
              <p className="text-body text-ink-secondary">
                Your account is not linked to a clinic yet. An admin will link your profile after reviewing your application.
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

  const clinic = await payload.findByID({
    collection: 'clinics',
    id: clinicId,
    depth: 1,
    overrideAccess: true,
  }).catch(() => null) as any

  if (!clinic) redirect('/')

  // The plan on file vs the plan in force: a paid tier only counts while billing is active.
  const planTier = (clinic.subscriptionTier as Tier) || 'free'
  const planStatus = (clinic.subscriptionStatus as SubscriptionStatus) || 'none'
  const tier = effectiveTier(clinic)
  const tierLimits = limits(tier)
  const showAnalytics = tierLimits.analytics !== 'none'

  const slugMap = await getLocationSlugMap()
  const slugs = lookupSlugs(clinic.city ?? '', clinic.state ?? '', slugMap)
  const publicHref = clinic.slug
    ? `/clinics/${slugs.stateSlug}/${slugs.citySlug}/${clinic.slug}`
    : null

  // Bookings/leads for this clinic
  const bookingsRes = await payload.find({
    collection: 'bookings',
    where: { clinic: { equals: clinicId } },
    limit: 20,
    sort: '-createdAt',
    depth: 0,
    overrideAccess: true,
  }).catch(() => ({ docs: [], totalDocs: 0 }))
  const totalBookings = (bookingsRes as any).totalDocs ?? bookingsRes.docs.length
  const leads: OwnerLead[] = (bookingsRes.docs as any[]).map(toOwnerLead)

  // Real numbers from analytics.events (the old tile read clinic.profileViewCount, a field that never existed).
  const analytics = showAnalytics
    ? await clinicAnalytics(payload, clinicId, ANALYTICS_DAYS[tierLimits.analytics], tierLimits.analytics === 'full')
    : null

  // This clinic's before/after cases, every status (the owner sees what is pending).
  const casesRes = await payload.find({
    collection: 'before-after-cases',
    where: { clinic: { equals: clinicId } },
    limit: MAX_BEFORE_AFTER,
    sort: '-createdAt',
    depth: 0,
    overrideAccess: true,
  }).catch(() => ({ docs: [] }))
  const beforeAfterCases = (casesRes.docs as any[]).map(toOwnerCase)

  // Options for the edit form (all published brands + services)
  const [brandsRes, servicesRes] = await Promise.all([
    payload.find({ collection: 'brands', limit: 200, sort: 'name', depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'services', limit: 200, sort: 'name', depth: 0, overrideAccess: true }).catch(() => ({ docs: [] })),
  ])
  const brandOptions: RelOption[] = (brandsRes.docs as any[]).map((b) => ({ id: String(b.id), name: b.name }))
  const serviceOptions: RelOption[] = (servicesRes.docs as any[]).map((s) => ({ id: String(s.id), name: s.name }))

  const hoursRaw = (clinic.hoursJson && typeof clinic.hoursJson === 'object') ? clinic.hoursJson as Record<string, string> : {}
  const formInitial: ClinicFormData = {
    tagline: clinic.tagline || '',
    description: clinic.description || '',
    clinicType: clinic.clinicType || '',
    acceptsInsurance: Boolean(clinic.acceptsInsurance),
    paymentMethods: clinic.paymentMethods || '',
    amenities: clinic.amenities || '',
    phone: clinic.phone || '',
    email: clinic.email || '',
    emailPublic: Boolean(clinic.emailPublic),
    websiteUrl: clinic.websiteUrl || '',
    instagramUrl: clinic.instagramUrl || '',
    tiktokUrl: clinic.tiktokUrl || '',
    facebookUrl: clinic.facebookUrl || '',
    linkedinUrl: clinic.linkedinUrl || '',
    youtubeUrl: clinic.youtubeUrl || '',
    videoUrl: clinic.videoUrl || '',
    hours: {
      mon: hoursRaw.mon || '',
      tue: hoursRaw.tue || '',
      wed: hoursRaw.wed || '',
      thu: hoursRaw.thu || '',
      fri: hoursRaw.fri || '',
      sat: hoursRaw.sat || '',
      sun: hoursRaw.sun || '',
    },
    brandsOffered: (Array.isArray(clinic.brandsOffered) ? clinic.brandsOffered : [])
      .map((b: any) => String(typeof b === 'object' ? b?.id : b))
      .filter((id: string) => id && id !== 'undefined' && id !== 'null'),
    servicesOffered: (Array.isArray(clinic.servicesOffered) ? clinic.servicesOffered : [])
      .map((s: any) => String(typeof s === 'object' ? s?.id : s))
      .filter((id: string) => id && id !== 'undefined' && id !== 'null'),
    startingPrice: clinic.startingPrice ?? null,
  }

  // The whole public gallery: imported photos (clinicPhotoUrls) plus the owner's
  // uploads. Uploads carry their Media id, which is what counts toward the plan limit.
  const uploads = new Map<string, number>(
    (Array.isArray(clinic.photos) ? clinic.photos : [])
      .filter((p: any) => p && typeof p === 'object' && p.url)
      .map((p: any) => [p.url as string, Number(p.id)]),
  )
  const galleryUrls: string[] = (Array.isArray(clinic.clinicPhotoUrls) ? clinic.clinicPhotoUrls : [])
    .map((p: any) => p?.url)
    .filter(Boolean)
  const initialPhotos: ClinicPhoto[] = Array.from(new Set([...galleryUrls, ...uploads.keys()]))
    .map((url) => ({ url, mediaId: uploads.get(url) }))

  const completenessSteps = computeClinicCompleteness({
    photos: initialPhotos,
    servicesOffered: clinic.servicesOffered,
    phone: clinic.phone,
    email: clinic.email,
    websiteUrl: clinic.websiteUrl,
    description: clinic.description,
    hoursJson: hoursRaw,
  })

  const TIER_COLORS: Record<Tier, string> = {
    free: 'bg-surface border-border',
    starter: 'bg-surface border-brand-accent/30',
    pro: 'bg-brand-accent-soft border-brand-accent/40',
    elite: 'bg-[#FAF5FF] border-[#7C3AED]/20 dark:bg-surface dark:border-[#7C3AED]/20',
  }
  const TIER_BADGES: Record<Tier, string> = {
    free: 'bg-surface border border-border text-ink-secondary',
    starter: 'bg-brand-accent-soft text-brand-accent',
    pro: 'bg-brand-primary text-surface-canvas',
    elite: 'bg-[#7C3AED] text-white',
  }

  return (
    <>
      <Header />

      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-caption text-ink-tertiary uppercase tracking-wider font-semibold mb-0.5">Clinic dashboard</p>
            <h1 className="font-serif text-h3 text-ink-primary">{clinic.clinicName}</h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {publicHref && (
              <Link href={publicHref} target="_blank" className="text-body-sm text-brand-accent hover:underline flex items-center gap-1">
                View public page
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
              </Link>
            )}
            <LogoutButton className="text-body-sm text-ink-secondary hover:text-ink-primary transition">
              Sign out
            </LogoutButton>
          </div>
        </div>
        {/* Owners of several locations switch here; one link per clinic on the account. */}
        {owned.length > 1 && (
          <nav aria-label="Your clinics" className="max-canvas pb-3 flex items-center gap-2 overflow-x-auto">
            <span className="shrink-0 text-caption text-ink-tertiary uppercase tracking-wider font-semibold">Your clinics</span>
            {owned.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/clinic?clinic=${c.id}`}
                aria-current={c.id === clinicId ? 'page' : undefined}
                className={`shrink-0 rounded-control border px-3 py-1.5 text-body-sm transition ${
                  c.id === clinicId
                    ? 'border-brand-primary bg-brand-primary text-surface-canvas'
                    : 'border-border text-ink-secondary hover:border-ink-secondary hover:text-ink-primary'
                }`}
              >
                {c.clinicName}
                {c.city ? `, ${c.city}` : ''}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <main className="bg-surface-canvas section-pad">
        <div className="max-canvas max-w-3xl space-y-14">

          <ClinicOnboardingChecklist steps={completenessSteps} />

          {/* Subscription tier */}
          <section>
            <div className={`rounded-2xl border p-5 ${TIER_COLORS[tier]}`}>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-control ${TIER_BADGES[tier]}`}>
                    {TIER_LABELS[tier]} plan
                  </span>
                  {tier !== 'free' && (
                    <span className="text-body-sm font-medium text-ink-secondary">{STATUS_LABELS.active}</span>
                  )}
                </div>
                {planTier !== 'elite' && (
                  <a href="/pricing" className="text-body-sm font-semibold text-brand-accent hover:underline">
                    Upgrade plan
                  </a>
                )}
              </div>
              {planTier !== 'free' && planStatus !== 'active' && (
                <p className="mb-4 text-body-sm text-ink-secondary">
                  {TIER_LABELS[planTier]} plan: {STATUS_LABELS[planStatus].toLowerCase()}. Your profile runs on the Free plan
                  until billing is sorted. Email{' '}
                  <ProtectedEmail
                    user="hello"
                    subject={`Billing: ${clinic.clinicName}`}
                    className="font-medium text-brand-accent hover:underline"
                  />
                  .
                </p>
              )}
              {showAnalytics ? (
                <ClinicAnalyticsPanel data={analytics} />
              ) : (
                <p className="text-body-sm text-ink-secondary">
                  Analytics are available on the{' '}
                  <a href="/pricing" className="text-brand-accent hover:underline font-medium">Pro plan</a>.
                </p>
              )}
            </div>
          </section>

          {/* Clinic profile editor */}
          <section>
            <div className="border-b border-border pb-3 mb-6 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-h3 text-ink-primary">Edit clinic profile</h2>
              <p className="text-caption text-ink-tertiary">
                {clinic.clinicName} · {clinic.city}, {clinic.state}
              </p>
            </div>
            <ClinicProfileForm
              clinicId={clinicId}
              initial={formInitial}
              initialPhotos={initialPhotos}
              brandOptions={brandOptions}
              serviceOptions={serviceOptions}
              tier={tier}
              maxPhotos={tierLimits.maxPhotos}
            />
          </section>

          {/* Before and after (Pro and Elite) */}
          <section id="before-after" className="scroll-mt-28">
            <div className="border-b border-border pb-3 mb-6">
              <h2 className="font-serif text-h3 text-ink-primary">Before and after</h2>
              <p className="mt-1 text-body-sm text-ink-secondary">
                Real results from your patients, side by side. Each pair is checked by our team before it shows on your page.
              </p>
            </div>
            <BeforeAfterManager
              clinicId={clinicId}
              initial={beforeAfterCases}
              treatments={serviceOptions.map((s) => s.name)}
              allowed={can(tier, 'beforeAfterGallery')}
            />
          </section>

          {/* Leads */}
          <section id="leads" className="scroll-mt-28">
            <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3 mb-6">Recent leads</h2>
            <LeadsList clinicId={clinicId} initial={leads} total={totalBookings} tools={tierLimits.leadTools} contactEmail={clinic.email || undefined} />
          </section>

        </div>
      </main>

      <Footer />
    </>
  )
}
