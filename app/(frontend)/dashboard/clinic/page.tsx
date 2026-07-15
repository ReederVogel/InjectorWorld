import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { getPayloadInstance } from '@/lib/payload-server'
import { getAuthUser } from '@/lib/auth-user'
import { getLocationSlugMap, lookupSlugs } from '@/lib/location-slug-lookup'
import { limits, TIER_LABELS, type Tier } from '@/lib/entitlements'
import { ClinicProfileForm, type ClinicFormData, type RelOption } from '@/components/dashboard/ClinicProfileForm'
import type { ClinicPhoto } from '@/components/dashboard/PhotoUpload'
import { ClinicOnboardingChecklist } from '@/components/dashboard/ClinicOnboardingChecklist'
import { computeClinicCompleteness } from '@/lib/clinic-completeness'

export const metadata: Metadata = {
  title: { absolute: 'Clinic dashboard | injector.world' },
  robots: 'noindex',
}

export const dynamic = 'force-dynamic'

function relId(rel: unknown): number | null {
  if (rel == null) return null
  if (typeof rel === 'object') return Number((rel as { id?: number | string }).id)
  return Number(rel)
}

export default async function ClinicDashboardPage() {
  const payload = await getPayloadInstance()
  const user = await getAuthUser(payload)

  if (!user) redirect('/login?next=/dashboard/clinic')

  const role = (user as any).role
  if (role === 'user') redirect('/dashboard')
  if (role === 'provider') redirect('/dashboard/provider')
  if (role === 'brand') redirect('/dashboard/brand')
  if (role === 'admin' || role === 'editor') redirect('/admin')
  if (role !== 'clinic') redirect('/')

  const clinicId = relId((user as any).linkedClinic)

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

  const tier = (clinic.subscriptionTier as Tier) || 'free'
  const tierLimits = limits(tier)
  const showAnalytics = tierLimits.analytics !== 'none'

  const slugMap = await getLocationSlugMap()
  const slugs = lookupSlugs(clinic.city ?? '', clinic.state ?? '', slugMap)
  const publicHref = clinic.slug
    ? `/clinics/${slugs.stateSlug}/${slugs.citySlug}/${clinic.slug}`
    : null

  // Providers at this clinic
  const providersRes = await payload.find({
    collection: 'providers',
    where: { clinic: { equals: clinicId } },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  }).catch(() => ({ docs: [] }))
  const providers = providersRes.docs as any[]

  // Bookings/leads for this clinic
  const bookingsRes = await payload.find({
    collection: 'bookings',
    where: { clinic: { equals: clinicId } },
    limit: 20,
    sort: '-createdAt',
    depth: 0,
    overrideAccess: true,
  }).catch(() => ({ docs: [], totalDocs: 0 }))
  const bookings = bookingsRes.docs as any[]
  const totalBookings = (bookingsRes as any).totalDocs ?? bookings.length

  // Profile view count
  const profileViewCount: number = clinic.profileViewCount ?? 0

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
    serviceType: clinic.serviceType || 'In-Person',
    yearEstablished: clinic.yearEstablished ?? null,
    acceptsInsurance: Boolean(clinic.acceptsInsurance),
    paymentMethods: clinic.paymentMethods || '',
    amenities: clinic.amenities || '',
    phone: clinic.phone || '',
    email: clinic.email || '',
    websiteUrl: clinic.websiteUrl || '',
    bookingUrl: clinic.bookingUrl || '',
    instagramUrl: clinic.instagramUrl || '',
    tiktokUrl: clinic.tiktokUrl || '',
    facebookUrl: clinic.facebookUrl || '',
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
    offersVirtualConsult: Boolean(clinic.offersVirtualConsult),
    acceptsNewPatients: clinic.acceptsNewPatients !== false,
    startingPrice: clinic.startingPrice ?? null,
    languages: Array.isArray(clinic.languages) ? clinic.languages : [],
  }

  const initialPhotos: ClinicPhoto[] = (Array.isArray(clinic.photos) ? clinic.photos : [])
    .filter((p: any) => p && typeof p === 'object' && p.url)
    .map((p: any) => ({ id: Number(p.id), url: p.url as string }))

  const completenessSteps = computeClinicCompleteness({
    photos: clinic.photos,
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
      </div>

      <main className="bg-surface-canvas section-pad">
        <div className="max-canvas max-w-3xl space-y-14">

          <ClinicOnboardingChecklist steps={completenessSteps} />

          {/* Subscription tier */}
          <section>
            <div className={`rounded-2xl border p-5 ${TIER_COLORS[tier]}`}>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <span className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-pill ${TIER_BADGES[tier]}`}>
                  {TIER_LABELS[tier]} plan
                </span>
                {tier !== 'elite' && (
                  <a href="/pricing" className="text-body-sm font-semibold text-brand-accent hover:underline">
                    Upgrade plan
                  </a>
                )}
              </div>
              {showAnalytics ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-surface/80 border border-border p-4">
                    <p className="text-caption text-ink-tertiary mb-0.5 font-medium uppercase tracking-wider">Page views</p>
                    <p className="font-serif text-[1.75rem] leading-tight font-medium text-ink-primary">{profileViewCount.toLocaleString()}</p>
                    <p className="text-caption text-ink-tertiary mt-0.5">All time</p>
                  </div>
                  <div className="rounded-xl bg-surface/80 border border-border p-4">
                    <p className="text-caption text-ink-tertiary mb-0.5 font-medium uppercase tracking-wider">Total leads</p>
                    <p className="font-serif text-[1.75rem] leading-tight font-medium text-ink-primary">{totalBookings.toLocaleString()}</p>
                    <p className="text-caption text-ink-tertiary mt-0.5">Via injector.world</p>
                  </div>
                  <div className="rounded-xl bg-surface/80 border border-border p-4">
                    <p className="text-caption text-ink-tertiary mb-0.5 font-medium uppercase tracking-wider">Providers</p>
                    <p className="font-serif text-[1.75rem] leading-tight font-medium text-ink-primary">{providers.length}</p>
                    <p className="text-caption text-ink-tertiary mt-0.5">Listed here</p>
                  </div>
                </div>
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
              initial={formInitial}
              initialPhotos={initialPhotos}
              brandOptions={brandOptions}
              serviceOptions={serviceOptions}
              tier={tier}
              maxPhotos={tierLimits.maxPhotos}
            />
          </section>

          {/* Providers at this clinic */}
          <section>
            <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3 mb-6">
              Providers ({providers.length})
            </h2>
            {providers.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-6 text-center">
                <p className="text-body text-ink-secondary">No providers listed at this clinic yet.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {providers.map((p: any) => (
                  <li key={p.id} className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
                    {p.profilePhotoUrl && (
                      <img src={p.profilePhotoUrl} alt={p.fullName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm font-semibold text-ink-primary truncate">{p.fullName}</p>
                      <p className="text-caption text-ink-tertiary">{p.credentials}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Leads */}
          <section>
            <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3 mb-6">Recent leads</h2>
            {bookings.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-6 text-center">
                <p className="text-body text-ink-secondary">No leads yet. Your clinic page is live and accepting bookings.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((b: any) => {
                  const statusColors: Record<string, string> = {
                    new: 'bg-[#FEF3C7] text-[#92400E]',
                    confirmed: 'bg-brand-accent-soft text-brand-accent',
                    completed: 'bg-[#F0FDF4] text-[#166534]',
                    cancelled: 'bg-[#FEE2E2] text-[#991B1B]',
                  }
                  const statusClass = statusColors[b.status] ?? 'bg-surface-warm text-ink-secondary'
                  return (
                    <div key={b.id} className="rounded-xl border border-border bg-surface p-4 flex flex-wrap items-center gap-3 justify-between">
                      <div>
                        <p className="text-body-sm font-medium text-ink-primary">{b.submitterName || 'Anonymous'}</p>
                        <p className="text-caption text-ink-tertiary">
                          {b.submitterEmail} · {new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        {b.message && (
                          <p className="text-body-sm text-ink-secondary mt-1 line-clamp-2">{b.message}</p>
                        )}
                      </div>
                      <span className={`text-[11px] font-semibold px-3 py-1 rounded-pill ${statusClass}`}>
                        {b.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

        </div>
      </main>

      <Footer />
    </>
  )
}
