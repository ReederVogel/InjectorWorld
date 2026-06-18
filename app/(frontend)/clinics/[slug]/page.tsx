import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { getClinicBySlug, getClinicReviews, getAllClinicSlugs, type ClinicProvider, type ClinicReviewRow } from '@/lib/clinic-queries'
import { getBrandForClinic } from '@/lib/brand-queries'
import { ReviewBreakdown } from '@/components/ui/ReviewBreakdown'

export const revalidate = 300

export async function generateStaticParams() {
  try {
    const slugs = await getAllClinicSlugs()
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
  const clinic = await getClinicBySlug(slug)
  if (!clinic) return {}
  return {
    title: `${clinic.clinicName} — ${clinic.city}, ${clinic.state}`,
    description: clinic.description
      ? clinic.description.slice(0, 155)
      : `${clinic.clinicName} is a ${clinic.serviceType.toLowerCase()} aesthetic clinic in ${clinic.city}, ${clinic.state}. ${clinic.aggregateRatingCount} patient reviews. ${clinic.providers.length} verified providers.`,
    openGraph: {
      type: 'website',
      images: clinic.photoUrls.length > 0 ? [clinic.photoUrls[0]] : [],
    },
  }
}

export default async function ClinicDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const clinic = await getClinicBySlug(slug)
  if (!clinic) notFound()

  const [reviews, brand] = await Promise.all([
    getClinicReviews(clinic.id),
    getBrandForClinic(clinic.brandRef, clinic.id),
  ])

  const stars = Math.round(clinic.aggregateRating || 0)

  // Schema.org JSON-LD: MedicalBusiness + LocalBusiness + OpeningHours
  const schema = {
    '@context': 'https://schema.org',
    '@type': ['MedicalBusiness', 'LocalBusiness'],
    name: clinic.clinicName,
    description: clinic.description || clinic.tagline,
    image: clinic.photoUrls[0],
    telephone: clinic.phone,
    email: clinic.email,
    url: clinic.websiteUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: clinic.addressLine1,
      addressLocality: clinic.city,
      addressRegion: clinic.state,
      postalCode: clinic.zip,
      addressCountry: 'US',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: clinic.latitude,
      longitude: clinic.longitude,
    },
    ...(clinic.aggregateRating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: clinic.aggregateRating,
            reviewCount: clinic.aggregateRatingCount || 0,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(reviews.length > 0
      ? {
          review: reviews.slice(0, 5).map((r) => ({
            '@type': 'Review',
            author: { '@type': 'Person', name: r.reviewerFirstName || 'Patient' },
            reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
            reviewBody: r.reviewText,
            datePublished: r.reviewDate,
          })),
        }
      : {}),
    ...(clinic.googleMapsUrl ? { hasMap: clinic.googleMapsUrl } : {}),
    ...(clinic.yearEstablished ? { foundingDate: String(clinic.yearEstablished) } : {}),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://injector.world' },
      { '@type': 'ListItem', position: 2, name: 'Clinics', item: 'https://injector.world/clinics' },
      { '@type': 'ListItem', position: 3, name: clinic.clinicName },
    ],
  }

  const amenitiesList = clinic.amenities
    ? clinic.amenities.split(';').map((a) => a.trim()).filter(Boolean)
    : []

  const paymentList = clinic.paymentMethods
    ? clinic.paymentMethods.split(';').map((p) => p.trim()).filter(Boolean)
    : []

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema).replace(/</g, '\\u003c') }}
      />

      <Header />

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <Link href="/clinics" className="hover:text-ink-primary transition">Clinics</Link>
            <span>/</span>
            <span className="text-ink-primary truncate">{clinic.clinicName}</span>
          </nav>
        </div>
      </div>

      {/* Photo gallery */}
      {clinic.photoUrls.length > 0 && (
        <div className="relative w-full h-[280px] md:h-[420px] bg-surface overflow-hidden">
          <Image
            src={clinic.photoUrls[0]}
            alt={clinic.clinicName}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          {clinic.photoUrls.length > 1 && (
            <div className="absolute bottom-4 right-4 flex gap-2 overflow-x-auto max-w-[260px] md:max-w-[400px]">
              {clinic.photoUrls.slice(1, 4).map((url, i) => (
                <div key={i} className="relative w-20 h-14 md:w-28 md:h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 border-white/40">
                  <Image src={url} alt={`${clinic.clinicName} interior ${i + 2}`} fill sizes="112px" className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clinic identity bar */}
      <section className="bg-surface-canvas py-8 md:py-10 border-b border-border">
        <div className="max-canvas">
          <div className="flex flex-col md:flex-row md:items-start gap-6 md:gap-12">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 bg-brand-accent-soft text-brand-accent text-[11px] font-semibold px-3 py-1 rounded-pill">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Verified clinic
                </span>
                <span className="inline-flex text-[11px] font-semibold px-3 py-1 rounded-pill border border-border text-ink-secondary">
                  {clinic.serviceType}
                </span>
                {clinic.yearEstablished && (
                  <span className="inline-flex text-[11px] font-semibold px-3 py-1 rounded-pill border border-border text-ink-secondary">
                    Est. {clinic.yearEstablished}
                  </span>
                )}
              </div>
              <h1 className="font-serif text-h1-m md:text-[2.25rem] font-medium leading-tight tracking-tight text-ink-primary mb-1">
                {clinic.clinicName}
              </h1>
              {brand && (
                <Link
                  href={`/brands/${brand.slug}`}
                  className="inline-flex items-center gap-1.5 text-body-sm text-brand-accent hover:underline mb-1"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                    <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9v.01M9 12v.01M9 15v.01" />
                  </svg>
                  Part of {brand.name}
                  {brand.otherLocations.length > 0 && (
                    <span className="text-ink-tertiary">
                      ({brand.otherLocations.length + 1} locations)
                    </span>
                  )}
                </Link>
              )}
              <p className="text-body text-ink-secondary">
                {clinic.addressLine1}{clinic.addressLine2 ? `, ${clinic.addressLine2}` : ''},{' '}
                {clinic.neighborhood ? `${clinic.neighborhood}, ` : ''}
                {clinic.city}, {clinic.state} {clinic.zip}
              </p>
              {clinic.aggregateRating && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="star-row text-[15px]">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
                  <span className="font-semibold text-body-sm text-ink-primary">{clinic.aggregateRating.toFixed(1)}</span>
                  <span className="text-body-sm text-ink-secondary">({clinic.aggregateRatingCount?.toLocaleString()} reviews)</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 md:flex-row lg:flex-col min-w-fit">
              {clinic.bookingUrl && (
                <a
                  href={clinic.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-brand-primary text-surface-canvas rounded-pill px-6 py-3 text-body-sm font-semibold hover:opacity-90 transition"
                >
                  Book appointment
                </a>
              )}
              {clinic.directionsUrl && (
                <a
                  href={clinic.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 border border-border rounded-pill px-6 py-3 text-body-sm font-medium text-ink-primary hover:bg-surface hover:border-brand-accent transition"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                  Get directions
                </a>
              )}
              {clinic.phone && (
                <a
                  href={`tel:${clinic.phone}`}
                  className="flex items-center justify-center gap-2 border border-border rounded-pill px-6 py-3 text-body-sm font-medium text-ink-primary hover:bg-surface hover:border-brand-accent transition"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.81 19.79 19.79 0 01.01 2.18 2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92z" />
                  </svg>
                  {clinic.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 lg:gap-14">

            {/* LEFT: main */}
            <div className="space-y-12">

              {/* About */}
              {(clinic.description || clinic.tagline) && (
                <div>
                  <h2 className="font-serif text-h3 text-ink-primary mb-4">About {clinic.clinicName}</h2>
                  {clinic.tagline && (
                    <p className="text-body-lg font-serif text-ink-secondary mb-3 italic">{clinic.tagline}</p>
                  )}
                  {clinic.description && (
                    <p className="text-body text-ink-secondary leading-relaxed">{clinic.description}</p>
                  )}
                </div>
              )}

              {/* Providers at this clinic */}
              {clinic.providers.length > 0 && (
                <div>
                  <h2 className="font-serif text-h3 text-ink-primary mb-6">
                    Injectors at {clinic.clinicName}
                  </h2>
                  <div className="space-y-4">
                    {clinic.providers.map((p) => (
                      <ProviderRow key={p.id} p={p} />
                    ))}
                  </div>
                </div>
              )}

              {/* Reviews */}
              {reviews.length > 0 && (
                <div>
                  <h2 className="font-serif text-h3 text-ink-primary mb-6">Patient reviews</h2>
                  {/* Rating breakdown */}
                  <div className="rounded-xl border border-border bg-surface p-5 mb-6">
                    <ReviewBreakdown
                      reviews={reviews}
                      aggregateRating={clinic.aggregateRating}
                      aggregateRatingCount={clinic.aggregateRatingCount}
                    />
                  </div>
                  <div className="space-y-5">
                    {reviews.map((r) => (
                      <ReviewCard key={r.id} r={r} />
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* RIGHT: sidebar */}
            <div className="space-y-5">

              {/* Contact info */}
              <div className="rounded-2xl border border-border bg-surface p-5">
                <h3 className="text-h4 text-ink-primary mb-4">Contact</h3>
                <div className="space-y-3 text-body-sm">
                  <InfoRow icon={<AddressIcon />} label={`${clinic.addressLine1}${clinic.addressLine2 ? `, ${clinic.addressLine2}` : ''}, ${clinic.city}, ${clinic.state} ${clinic.zip}`} />
                  {clinic.phone && (
                    <a href={`tel:${clinic.phone}`} className="flex items-start gap-3 text-ink-secondary hover:text-ink-primary transition">
                      <PhoneIcon />
                      {clinic.phone}
                    </a>
                  )}
                  {clinic.email && (
                    <a href={`mailto:${clinic.email}`} className="flex items-start gap-3 text-ink-secondary hover:text-ink-primary transition">
                      <EmailIcon />
                      {clinic.email}
                    </a>
                  )}
                  {clinic.websiteUrl && (
                    <a href={clinic.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-brand-accent hover:underline">
                      <WebIcon />
                      Visit website
                    </a>
                  )}
                </div>
              </div>

              {/* Amenities */}
              {amenitiesList.length > 0 && (
                <div className="rounded-2xl border border-border bg-surface p-5">
                  <h3 className="text-h4 text-ink-primary mb-3">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {amenitiesList.map((a) => (
                      <span key={a} className="text-body-sm px-3 py-1.5 rounded-pill border border-border text-ink-secondary">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment */}
              {(paymentList.length > 0 || clinic.acceptsInsurance) && (
                <div className="rounded-2xl border border-border bg-surface p-5">
                  <h3 className="text-h4 text-ink-primary mb-3">Payment</h3>
                  {clinic.acceptsInsurance && (
                    <p className="flex items-center gap-2 text-body-sm text-ink-secondary mb-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      Accepts insurance
                    </p>
                  )}
                  {paymentList.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {paymentList.map((p) => (
                        <span key={p} className="text-body-sm px-3 py-1 rounded-pill border border-border text-ink-secondary">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Part of a brand — other locations */}
              {brand && brand.otherLocations.length > 0 && (
                <div className="rounded-2xl border border-border bg-surface p-5">
                  <h3 className="text-h4 text-ink-primary mb-1">Other {brand.name} locations</h3>
                  <p className="text-caption text-ink-tertiary mb-4">
                    Same brand, different branches. Each is independently verified.
                  </p>
                  <div className="space-y-3">
                    {brand.otherLocations.slice(0, 5).map((loc) => (
                      <Link
                        key={loc.id}
                        href={`/clinics/${loc.slug}`}
                        className="flex items-start gap-2.5 text-body-sm text-ink-secondary hover:text-brand-accent transition group"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0 text-ink-tertiary group-hover:text-brand-accent">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>
                          <span className="font-medium text-ink-primary group-hover:text-brand-accent">{loc.clinicName}</span>
                          <span className="block text-caption text-ink-tertiary">{loc.city}, {loc.state}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                  <Link
                    href={`/brands/${brand.slug}`}
                    className="mt-4 inline-flex items-center gap-1.5 text-body-sm text-brand-accent hover:underline font-medium"
                  >
                    View all {brand.name} locations
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                  </Link>
                </div>
              )}

              {/* Claim this clinic */}
              {!clinic.claimed && (
                <div className="rounded-2xl border border-border-subtle bg-surface p-5">
                  <p className="text-body-sm font-medium text-ink-primary mb-1">Is this your clinic?</p>
                  <p className="text-caption text-ink-tertiary mb-3">
                    Claim it to update contact details and manage your profile.
                  </p>
                  <a
                    href={`/claim/clinic/${clinic.slug}`}
                    className="inline-flex items-center gap-1.5 text-body-sm text-brand-accent hover:underline font-medium"
                  >
                    Claim this clinic
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                  </a>
                </div>
              )}

              {/* Trust */}
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                <h3 className="text-h4 text-ink-primary">Verified by injector.world</h3>
                {[
                  'Practice credentials independently confirmed',
                  'Provider licenses checked against state boards',
                  'Reviews verified and moderated',
                  'Editorial rankings can\'t be bought',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-body-sm text-ink-secondary">
                    <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {item}
                  </div>
                ))}
                <Link href="/how-we-verify" className="block text-caption text-brand-accent hover:underline pt-1">
                  Learn how we verify
                </Link>
              </div>

            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}

function ProviderRow({ p }: { p: ClinicProvider }) {
  const stars = Math.round(p.aggregateRating || 0)
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-surface">
      <div className="relative w-14 h-14 rounded-pill overflow-hidden bg-surface-canvas flex-shrink-0 border-2 border-border shadow-sm">
        {p.profilePhotoUrl ? (
          <Image src={p.profilePhotoUrl} alt={p.fullName} fill sizes="56px" className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-tertiary">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={`/injectors/${p.slug}`} className="font-semibold text-body text-ink-primary hover:text-brand-accent transition">
              {p.fullName}
            </Link>
            <p className="text-body-sm text-ink-secondary mt-0.5">{p.title}</p>
          </div>
          {p.aggregateRating ? (
            <div className="flex-shrink-0 text-right">
              <div className="star-row text-[12px]">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</div>
              <div className="text-caption text-ink-tertiary">{p.aggregateRating.toFixed(1)}</div>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {p.treatments.slice(0, 4).map((t) => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-pill bg-brand-accent-soft text-brand-primary font-medium">
              {t}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <Link
            href={`/injectors/${p.slug}#book`}
            className="text-body-sm font-medium text-brand-accent hover:underline"
          >
            Book consult
          </Link>
          <span className="text-ink-tertiary text-caption">·</span>
          <Link
            href={`/injectors/${p.slug}`}
            className="text-body-sm text-ink-secondary hover:text-ink-primary transition"
          >
            View profile
          </Link>
          {p.startingPrice && (
            <>
              <span className="text-ink-tertiary text-caption">·</span>
              <span className="text-body-sm text-ink-secondary">from <strong className="text-ink-primary">${p.startingPrice}</strong></span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ReviewCard({ r }: { r: ClinicReviewRow }) {
  const stars = Math.round(r.rating)
  const date = r.reviewDate ? new Date(r.reviewDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : ''
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <span className="font-medium text-body-sm text-ink-primary">
            {r.reviewerFirstName || 'Patient'}{r.reviewerInitial ? ` ${r.reviewerInitial}.` : ''}
          </span>
          {r.treatmentTag && (
            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-pill bg-brand-accent-soft text-brand-primary font-medium">
              {r.treatmentTag}
            </span>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="star-row text-[12px]">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</div>
          {date && <div className="text-caption text-ink-tertiary mt-0.5">{date}</div>}
        </div>
      </div>
      {r.reviewTitle && <p className="font-semibold text-body-sm text-ink-primary mb-1.5">{r.reviewTitle}</p>}
      <p className="text-body-sm text-ink-secondary leading-relaxed">{r.reviewText}</p>
    </div>
  )
}

function InfoRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-start gap-3 text-ink-secondary">
      <span className="flex-shrink-0 mt-0.5">{icon}</span>
      {label}
    </div>
  )
}

function AddressIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.81 19.79 19.79 0 01.01 2.18 2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92z" />
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

function WebIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
    </svg>
  )
}
