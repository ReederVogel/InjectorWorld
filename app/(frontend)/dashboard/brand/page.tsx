import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { getPayloadInstance } from '@/lib/payload-server'
import { getAuthUser } from '@/lib/auth-user'

export const metadata: Metadata = {
  title: { absolute: 'Brand dashboard | injector.world' },
  robots: 'noindex',
}

export const dynamic = 'force-dynamic'

function relId(rel: unknown): number | null {
  if (rel == null) return null
  if (typeof rel === 'object') return Number((rel as { id?: number | string }).id)
  return Number(rel)
}

export default async function BrandDashboardPage() {
  const payload = await getPayloadInstance()
  const user = await getAuthUser(payload)

  if (!user) redirect('/login?next=/dashboard/brand')

  const role = (user as any).role
  if (role === 'patient') redirect('/dashboard')
  if (role === 'provider') redirect('/dashboard/provider')
  if (role === 'clinic') redirect('/dashboard/clinic')
  if (role === 'admin' || role === 'editor') redirect('/admin')
  if (role !== 'brand') redirect('/')

  const brandId = relId((user as any).linkedBrand)

  if (!brandId) {
    return (
      <>
        <Header />
        <main className="min-h-[60vh] bg-surface-canvas section-pad">
          <div className="max-canvas max-w-xl">
            <h1 className="font-serif text-h2 text-ink-primary mb-3">Brand dashboard</h1>
            <div className="rounded-2xl border border-border bg-surface p-6 text-center space-y-4">
              <p className="text-body text-ink-secondary">
                Your account is not linked to a brand yet. An admin will link your profile after reviewing your application.
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

  const brand = await payload.findByID({
    collection: 'brands',
    id: brandId,
    depth: 1,
    overrideAccess: true,
  }).catch(() => null) as any

  if (!brand) redirect('/')

  // Clinics in this brand
  const clinicsRes = await payload.find({
    collection: 'clinics',
    where: { brand: { equals: brandId } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  }).catch(() => ({ docs: [] }))
  const clinics = clinicsRes.docs as any[]

  // Bookings per clinic
  const bookingCounts: Record<string, number> = {}
  await Promise.all(
    clinics.map(async (c: any) => {
      try {
        const res = await payload.find({
          collection: 'bookings',
          where: { clinic: { equals: c.id } },
          limit: 0,
          depth: 0,
          overrideAccess: true,
        })
        bookingCounts[String(c.id)] = res.totalDocs
      } catch {
        bookingCounts[String(c.id)] = 0
      }
    }),
  )

  // Provider counts per clinic
  const providerCounts: Record<string, number> = {}
  await Promise.all(
    clinics.map(async (c: any) => {
      try {
        const res = await payload.find({
          collection: 'providers',
          where: { clinic: { equals: c.id } },
          limit: 0,
          depth: 0,
          overrideAccess: true,
        })
        providerCounts[String(c.id)] = res.totalDocs
      } catch {
        providerCounts[String(c.id)] = 0
      }
    }),
  )

  const totalLeads = Object.values(bookingCounts).reduce((sum, n) => sum + n, 0)
  const totalProviders = Object.values(providerCounts).reduce((sum, n) => sum + n, 0)

  const logoUrl =
    brand.logo && typeof brand.logo === 'object' ? (brand.logo.url as string | undefined) : undefined

  return (
    <>
      <Header />

      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {logoUrl && (
              <img src={logoUrl} alt={brand.name} className="w-10 h-10 rounded-lg object-contain border border-border bg-surface" />
            )}
            <div>
              <p className="text-caption text-ink-tertiary uppercase tracking-wider font-semibold mb-0.5">Brand dashboard</p>
              <h1 className="font-serif text-h3 text-ink-primary">{brand.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {brand.slug && (
              <Link href={`/brands/${brand.slug}`} target="_blank" className="text-body-sm text-brand-accent hover:underline flex items-center gap-1">
                View brand page
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

          {/* Overview */}
          <section>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Locations', value: clinics.length },
                { label: 'Total providers', value: totalProviders },
                { label: 'Total leads', value: totalLeads },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-border bg-surface p-4 text-center">
                  <p className="font-serif text-[1.75rem] leading-tight font-medium text-ink-primary">{value}</p>
                  <p className="text-caption text-ink-tertiary mt-1">{label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Brand profile */}
          <section>
            <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3 mb-6">Brand profile</h2>
            <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
              {brand.description && (
                <p className="text-body text-ink-secondary">{brand.description}</p>
              )}
              {brand.websiteUrl && (
                <p className="text-body-sm">
                  <strong className="text-ink-primary">Website:</strong>{' '}
                  <a href={brand.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline">
                    {brand.websiteUrl.replace(/^https?:\/\//, '')}
                  </a>
                </p>
              )}
              <p className="text-caption text-ink-tertiary">
                To update your brand profile, contact{' '}
                <a href="mailto:support@injector.world" className="text-brand-accent hover:underline">
                  support@injector.world
                </a>.
              </p>
            </div>
          </section>

          {/* Locations */}
          <section>
            <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3 mb-6">
              Locations ({clinics.length})
            </h2>
            {clinics.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-6 text-center">
                <p className="text-body text-ink-secondary">No clinic locations found for this brand.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clinics.map((c: any) => {
                  const pCount = providerCounts[String(c.id)] ?? 0
                  const bCount = bookingCounts[String(c.id)] ?? 0
                  const isLive = c.isLive ?? false
                  return (
                    <div key={c.id} className="rounded-xl border border-border bg-surface p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-body-sm font-semibold text-ink-primary">{c.clinicName}</p>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-pill ${isLive ? 'bg-brand-accent-soft text-brand-accent' : 'bg-surface border border-border text-ink-tertiary'}`}>
                              {isLive ? 'Live' : 'Draft'}
                            </span>
                          </div>
                          <p className="text-caption text-ink-tertiary">{c.city}, {c.state}</p>
                        </div>
                        <div className="flex gap-5 text-body-sm text-ink-secondary">
                          <span><strong className="text-ink-primary">{pCount}</strong> providers</span>
                          <span><strong className="text-ink-primary">{bCount}</strong> leads</span>
                        </div>
                      </div>
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
