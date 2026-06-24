import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { getPayloadInstance } from '@/lib/payload-server'
import { getAuthUser } from '@/lib/auth-user'
import { getLocationSlugMap, lookupSlugs } from '@/lib/location-slug-lookup'
import { PatientProfileForm } from '@/components/dashboard/PatientProfileForm'

export const metadata: Metadata = {
  title: { absolute: 'My dashboard | injector.world' },
  robots: 'noindex',
}

export const dynamic = 'force-dynamic'

export default async function PatientDashboardPage() {
  const payload = await getPayloadInstance()
  const user = await getAuthUser(payload)

  if (!user) redirect('/login?next=/dashboard')

  const role = (user as any).role
  if (role === 'provider') redirect('/dashboard/provider')
  if (role === 'clinic') redirect('/dashboard/clinic')
  if (role === 'brand') redirect('/dashboard/brand')
  if (role === 'admin' || role === 'editor') redirect('/admin')

  // Load full user with relationships
  const fullUser = await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 1,
    overrideAccess: true,
  }) as any

  const savedProviders: any[] = Array.isArray(fullUser.savedProviders)
    ? fullUser.savedProviders.filter((p: any) => p && typeof p === 'object')
    : []

  const savedClinics: any[] = Array.isArray(fullUser.savedClinics)
    ? fullUser.savedClinics.filter((c: any) => c && typeof c === 'object')
    : []

  // Recent bookings for this user's email
  const bookingsRes = await payload.find({
    collection: 'bookings',
    where: { submitterEmail: { equals: fullUser.email } },
    limit: 10,
    sort: '-createdAt',
    depth: 1,
    overrideAccess: true,
  }).catch(() => ({ docs: [] }))

  const bookings = bookingsRes.docs as any[]

  // Newsletter subscription
  const subRes = await payload.find({
    collection: 'subscribers',
    where: { email: { equals: fullUser.email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  }).catch(() => ({ docs: [] }))
  const subscriber = (subRes.docs[0] as any) ?? null
  const isSubscribed = subscriber?.status === 'confirmed'

  const slugMap = await getLocationSlugMap()

  return (
    <>
      <Header />

      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-caption text-ink-tertiary uppercase tracking-wider font-semibold mb-0.5">My account</p>
            <h1 className="font-serif text-h3 text-ink-primary">{fullUser.name || fullUser.email}</h1>
          </div>
          <LogoutButton className="text-body-sm text-ink-secondary hover:text-ink-primary transition flex-shrink-0">
            Sign out
          </LogoutButton>
        </div>
      </div>

      <main className="bg-surface-canvas section-pad">
        <div className="max-canvas max-w-3xl space-y-14">

          {/* Saved providers */}
          <section>
            <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3 mb-6">Saved providers</h2>
            {savedProviders.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-6 text-center">
                <p className="text-body text-ink-secondary mb-3">No saved providers yet.</p>
                <Link href="/injectors" className="text-body-sm text-brand-accent hover:underline">
                  Browse providers
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {savedProviders.map((p: any) => {
                  const slugs = p.clinic && typeof p.clinic === 'object'
                    ? lookupSlugs(p.clinic.city ?? '', p.clinic.state ?? '', slugMap)
                    : null
                  const href = slugs && p.slug
                    ? `/injectors/${slugs.stateSlug}/${slugs.citySlug}/${p.slug}`
                    : null
                  return (
                    <li key={p.id} className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
                      {p.profilePhotoUrl && (
                        <img src={p.profilePhotoUrl} alt={p.fullName} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-body-sm font-semibold text-ink-primary truncate">{p.fullName}</p>
                        <p className="text-caption text-ink-tertiary">{p.credentials}{p.clinic?.city ? ` · ${p.clinic.city}, ${p.clinic.state}` : ''}</p>
                      </div>
                      {href && (
                        <Link href={href} className="text-caption text-brand-accent hover:underline flex-shrink-0">
                          View profile
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Saved clinics */}
          <section>
            <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3 mb-6">Saved clinics</h2>
            {savedClinics.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-6 text-center">
                <p className="text-body text-ink-secondary mb-3">No saved clinics yet.</p>
                <Link href="/clinics" className="text-body-sm text-brand-accent hover:underline">
                  Browse clinics
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {savedClinics.map((c: any) => {
                  const slugs = lookupSlugs(c.city ?? '', c.state ?? '', slugMap)
                  const href = c.slug ? `/clinics/${slugs.stateSlug}/${slugs.citySlug}/${c.slug}` : null
                  return (
                    <li key={c.id} className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-body-sm font-semibold text-ink-primary truncate">{c.clinicName}</p>
                        <p className="text-caption text-ink-tertiary">{c.city}, {c.state}</p>
                      </div>
                      {href && (
                        <Link href={href} className="text-caption text-brand-accent hover:underline flex-shrink-0">
                          View clinic
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Booking history */}
          <section>
            <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3 mb-6">Booking history</h2>
            {bookings.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-6 text-center">
                <p className="text-body text-ink-secondary">No consult requests yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((b: any) => {
                  const provName = b.provider && typeof b.provider === 'object' ? b.provider.fullName : 'Provider'
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
                        <p className="text-body-sm font-medium text-ink-primary">{provName}</p>
                        <p className="text-caption text-ink-tertiary">{new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
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

          {/* Profile settings */}
          <section>
            <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3 mb-6">Profile settings</h2>
            <div className="rounded-2xl border border-border bg-surface p-6">
              <PatientProfileForm
                userId={String(fullUser.id)}
                initialName={fullUser.name || ''}
                initialEmail={fullUser.email || ''}
              />
            </div>
          </section>

          {/* Email preferences */}
          <section>
            <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3 mb-6">Email preferences</h2>
            <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-body-sm font-medium text-ink-primary">Newsletter</p>
                  <p className="text-caption text-ink-tertiary mt-0.5">
                    {isSubscribed ? 'You are subscribed to the injector.world newsletter.' : 'Get the latest aesthetic industry news.'}
                  </p>
                </div>
                {isSubscribed ? (
                  <a
                    href={`/api/newsletter/unsubscribe?email=${encodeURIComponent(fullUser.email)}`}
                    className="text-body-sm text-ink-secondary hover:text-[#B91C1C] transition flex-shrink-0"
                  >
                    Unsubscribe
                  </a>
                ) : (
                  <Link href="/#newsletter" className="text-body-sm text-brand-accent hover:underline flex-shrink-0">
                    Subscribe
                  </Link>
                )}
              </div>
            </div>
          </section>

        </div>
      </main>

      <Footer />
    </>
  )
}
