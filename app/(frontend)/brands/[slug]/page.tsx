import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { BrandBranchMap } from '@/components/brands/BrandBranchMap'
import { getBrandBySlug, getAllBrandSlugs, type BrandLocation, type BrandProvider } from '@/lib/brand-queries'
import { NOINDEX_ROBOTS } from '@/lib/markets'
import type { MapPin } from '@/components/ui/ListingMapInner'

export const revalidate = 300

export async function generateStaticParams() {
  try {
    const slugs = await getAllBrandSlugs()
    return slugs.map((slug) => ({ slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const brand = await getBrandBySlug(slug)
  if (!brand) return {}
  const where =
    brand.cities.length > 0
      ? `${brand.cities.slice(0, 3).join(', ')}${brand.cities.length > 3 ? ' and more' : ''}`
      : 'multiple locations'
  return {
    title: `${brand.name}: ${brand.locations.length} locations`,
    description:
      brand.description?.slice(0, 155) ||
      `${brand.name} operates ${brand.locations.length} verified aesthetic locations across ${where}. Find branches, providers, and book a consult.`,
    // Indexable only when at least one branch is in a live market (founder call).
    robots: brand.hasLiveLocation ? undefined : NOINDEX_ROBOTS,
    openGraph: {
      type: 'website',
      images: brand.locations.find((l) => l.photoUrl)?.photoUrl
        ? [brand.locations.find((l) => l.photoUrl)!.photoUrl!]
        : [],
    },
  }
}

export default async function BrandHubPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const brand = await getBrandBySlug(slug)
  if (!brand) notFound()

  const pins: MapPin[] = brand.locations
    .filter((l) => l.latitude && l.longitude)
    .map((l) => ({
      id: l.id,
      lat: l.latitude,
      lng: l.longitude,
      title: l.clinicName,
      subtitle: l.neighborhood ? `${l.neighborhood}, ${l.city}` : l.city,
      meta: l.state,
      href: `/clinics/${l.slug}`,
      rating: l.aggregateRating,
    }))

  const totalReviews = brand.locations.reduce((a, l) => a + (l.aggregateRatingCount || 0), 0)
  const rated = brand.locations.filter((l) => l.aggregateRating)
  const avgRating =
    rated.length > 0 ? rated.reduce((a, l) => a + (l.aggregateRating || 0), 0) / rated.length : 0

  // Schema: Organization + ItemList of branch MedicalBusiness + BreadcrumbList
  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand.name,
    description: brand.description,
    url: brand.websiteUrl || `https://injector.world/brands/${brand.slug}`,
    logo: brand.logoUrl,
    ...(avgRating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(avgRating.toFixed(1)),
            reviewCount: totalReviews,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    subOrganization: brand.locations.map((l) => ({
      '@type': 'MedicalBusiness',
      name: l.clinicName,
      address: { '@type': 'PostalAddress', addressLocality: l.city, addressRegion: l.state, addressCountry: 'US' },
      url: `https://injector.world/clinics/${l.slug}`,
    })),
  }

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: brand.locations.map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://injector.world/clinics/${l.slug}`,
      name: `${l.clinicName} (${l.city}, ${l.state})`,
    })),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://injector.world' },
      { '@type': 'ListItem', position: 2, name: 'Brands', item: 'https://injector.world/brands' },
      { '@type': 'ListItem', position: 3, name: brand.name },
    ],
  }

  return (
    <>
      {[orgSchema, itemListSchema, breadcrumbSchema].map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }}
        />
      ))}

      <Header />

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <Link href="/brands" className="hover:text-ink-primary transition">Brands</Link>
            <span>/</span>
            <span className="text-ink-primary truncate">{brand.name}</span>
          </nav>
        </div>
      </div>

      {/* Brand hero — always-dark navy band (matches /clinics, Footer pattern) */}
      <section className="bg-[#0B1B34] text-white pt-12 pb-12 md:pt-16 md:pb-16">
        <div className="max-canvas">
          <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
            {/* Logo / monogram */}
            <div className="flex-shrink-0">
              <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-2xl overflow-hidden bg-white/10 border border-white/15 flex items-center justify-center">
                {brand.logoUrl ? (
                  <Image src={brand.logoUrl} alt={brand.name} fill sizes="112px" className="object-contain p-2" />
                ) : (
                  <span className="font-serif text-[40px] md:text-[52px] text-white/90 leading-none">
                    {brand.name.charAt(0)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <p className="overline text-brand-accent mb-3 tracking-widest">Brand</p>
              <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight mb-3">
                {brand.name}
              </h1>
              {brand.description && (
                <p className="text-body-lg text-white/70 max-w-[640px] font-serif">{brand.description}</p>
              )}

              <div className="flex flex-wrap gap-6 mt-8 pt-8 border-t border-white/10">
                {[
                  { n: `${brand.locations.length}`, label: brand.locations.length === 1 ? 'Location' : 'Locations' },
                  { n: `${brand.states.length}`, label: brand.states.length === 1 ? 'State' : 'States' },
                  { n: `${brand.providers.length}`, label: brand.providers.length === 1 ? 'Injector' : 'Injectors' },
                  ...(avgRating ? [{ n: avgRating.toFixed(1), label: 'Avg rating' }] : []),
                ].map(({ n, label }) => (
                  <div key={label}>
                    <div className="font-semibold text-[26px] leading-none text-white">{n}</div>
                    <div className="text-caption text-white/60 mt-1">{label}</div>
                  </div>
                ))}
              </div>

              {brand.websiteUrl && (
                <a
                  href={brand.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-6 text-body-sm text-brand-accent hover:underline"
                >
                  Visit website
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Locations */}
      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          <h2 className="font-serif text-h3 text-ink-primary mb-2">All locations</h2>
          <p className="text-body text-ink-secondary mb-8">
            Every {brand.name} branch is its own verified listing. Pick the one nearest you.
          </p>

          {pins.length > 0 && (
            <div className="mb-8">
              <BrandBranchMap pins={pins} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {brand.locations.map((l) => (
              <BranchCard key={l.id} l={l} />
            ))}
          </div>
        </div>
      </section>

      {/* Providers */}
      {brand.providers.length > 0 && (
        <section className="section-pad bg-surface border-t border-border">
          <div className="max-canvas">
            <h2 className="font-serif text-h3 text-ink-primary mb-2">
              Injectors across {brand.name}
            </h2>
            <p className="text-body text-ink-secondary mb-8">
              {brand.providers.length} verified {brand.providers.length === 1 ? 'provider' : 'providers'} practicing at these locations.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {brand.providers.map((p) => (
                <BrandProviderCard key={p.id} p={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </>
  )
}

function BranchCard({ l }: { l: BrandLocation }) {
  const stars = Math.round(l.aggregateRating || 0)
  return (
    <Link
      href={`/clinics/${l.slug}`}
      className="group card-premium bg-surface-canvas rounded-2xl overflow-hidden flex flex-col border-2 border-border hover:border-brand-accent transition-all duration-200"
    >
      <div className="relative h-[180px] bg-surface overflow-hidden flex-shrink-0">
        {l.photoUrl ? (
          <Image
            src={l.photoUrl}
            alt={l.clinicName}
            fill
            sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface to-brand-accent-soft" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
        {!l.isLive && (
          <span className="absolute top-3 left-3 bg-white/90 text-ink-secondary text-[10px] font-semibold px-2.5 py-1 rounded-pill">
            Coming soon
          </span>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-semibold text-body text-ink-primary mb-1 leading-tight group-hover:text-brand-accent transition">
          {l.clinicName}
        </h3>
        <p className="text-body-sm text-ink-secondary mb-3">
          {l.neighborhood ? `${l.neighborhood}, ` : ''}{l.city}, {l.state}
        </p>
        {l.aggregateRating ? (
          <div className="flex items-center gap-2 mb-3">
            <span className="star-row text-[13px]">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
            <span className="text-body-sm text-ink-secondary">
              {l.aggregateRating.toFixed(1)} ({l.aggregateRatingCount?.toLocaleString()})
            </span>
          </div>
        ) : null}
        <p className="mt-auto text-caption text-ink-tertiary">
          {l.providerCount} {l.providerCount === 1 ? 'injector' : 'injectors'} here
        </p>
      </div>
    </Link>
  )
}

function BrandProviderCard({ p }: { p: BrandProvider }) {
  const stars = Math.round(p.aggregateRating || 0)
  return (
    <Link
      href={`/injectors/${p.slug}`}
      className="flex items-center gap-4 p-4 rounded-xl border border-border bg-surface-canvas hover:border-brand-accent transition"
    >
      <div className="relative w-12 h-12 rounded-pill overflow-hidden bg-surface flex-shrink-0 border border-border">
        {p.profilePhotoUrl ? (
          <Image src={p.profilePhotoUrl} alt={p.fullName} fill sizes="48px" className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-tertiary">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-body-sm text-ink-primary truncate">
          {p.fullName}{p.credentials ? `, ${p.credentials}` : ''}
        </p>
        <p className="text-caption text-ink-tertiary truncate">
          {p.clinicCity ? `${p.clinicCity}, ${p.clinicState}` : p.title}
        </p>
        {p.aggregateRating ? (
          <span className="star-row text-[11px]">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
        ) : null}
      </div>
    </Link>
  )
}
