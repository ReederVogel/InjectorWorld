import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { getProviderBySlug, getProviderReviews, getAllProviderSlugs, type ReviewRow } from '@/lib/provider-queries'

export const revalidate = 300

export async function generateStaticParams() {
  try {
    const slugs = await getAllProviderSlugs()
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
  const provider = await getProviderBySlug(slug)
  if (!provider) return {}
  return {
    title: `${provider.fullName}, ${provider.credentials} — ${provider.clinic.city}`,
    description: provider.bio
      ? provider.bio.slice(0, 155)
      : `${provider.fullName} is a ${provider.title} at ${provider.clinic.name} in ${provider.clinic.city}, ${provider.clinic.state}. License verified. ${provider.aggregateRatingCount} patient reviews.`,
    openGraph: {
      type: 'profile',
      images: provider.profilePhotoUrl ? [provider.profilePhotoUrl] : [],
    },
  }
}

export default async function ProviderProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const provider = await getProviderBySlug(slug)
  if (!provider) notFound()

  const reviews = await getProviderReviews(provider.id)

  const stars = Math.round(provider.aggregateRating || 0)

  // Schema.org JSON-LD: Physician + AggregateRating + Review
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name: provider.fullName,
    description: provider.bio || `${provider.title} at ${provider.clinic.name}`,
    image: provider.profilePhotoUrl,
    telephone: provider.phoneDirect || undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: provider.clinic.city,
      addressRegion: provider.clinic.state,
      addressCountry: 'US',
    },
    ...(provider.aggregateRating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: provider.aggregateRating,
            reviewCount: provider.aggregateRatingCount || 0,
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
    ...(provider.licenseVerificationUrl ? { url: provider.licenseVerificationUrl } : {}),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://injector.world' },
      { '@type': 'ListItem', position: 2, name: 'Injectors', item: 'https://injector.world/injectors' },
      { '@type': 'ListItem', position: 3, name: provider.fullName },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <Header />

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <Link href="/injectors" className="hover:text-ink-primary transition">Injectors</Link>
            <span>/</span>
            <span className="text-ink-primary truncate">{provider.fullName}</span>
          </nav>
        </div>
      </div>

      {/* Profile hero */}
      <section className="bg-surface-canvas pt-10 pb-0">
        <div className="max-canvas">
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
            {/* Photo */}
            <div className="flex-shrink-0">
              <div className="relative w-32 h-32 md:w-44 md:h-44 rounded-2xl overflow-hidden bg-surface shadow-md border border-border">
                {provider.profilePhotoUrl ? (
                  <Image
                    src={provider.profilePhotoUrl}
                    alt={provider.fullName}
                    fill
                    sizes="(min-width:768px) 176px, 128px"
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-surface to-brand-accent-soft flex items-center justify-center">
                    <svg className="w-12 h-12 text-ink-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0 pb-8 md:pb-10">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 bg-brand-accent-soft text-brand-accent text-[11px] font-semibold px-3 py-1 rounded-pill">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  License verified
                </span>
                {provider.acceptsNewPatients && (
                  <span className="inline-flex items-center text-[11px] font-semibold px-3 py-1 rounded-pill border border-border text-ink-secondary">
                    Accepting new patients
                  </span>
                )}
                {provider.editorsPick && (
                  <span className="inline-flex items-center gap-1 bg-brand-accent text-white text-[11px] font-bold px-3 py-1 rounded-pill uppercase tracking-wider">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
                    </svg>
                    Editor's pick
                  </span>
                )}
              </div>

              <h1 className="font-serif text-h1-m md:text-[2.25rem] font-medium leading-tight tracking-tight text-ink-primary mb-1">
                {provider.fullName}
              </h1>
              <p className="text-body text-ink-secondary mb-4">{provider.title}</p>

              {/* Rating */}
              {provider.aggregateRating ? (
                <div className="flex items-center gap-2 mb-4">
                  <span className="star-row text-[15px]">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
                  <span className="font-semibold text-body-sm text-ink-primary">{provider.aggregateRating.toFixed(1)}</span>
                  <span className="text-body-sm text-ink-secondary">({provider.aggregateRatingCount?.toLocaleString()} reviews)</span>
                </div>
              ) : null}

              {/* Key meta */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-body-sm text-ink-secondary">
                <span>
                  <span className="text-ink-tertiary">License:</span>{' '}
                  <span className="font-medium text-ink-primary">
                    {provider.licenseStateCode} #{provider.licenseNumber} &mdash; {provider.licenseStatus}
                  </span>
                  {provider.licenseVerificationUrl && (
                    <a
                      href={provider.licenseVerificationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-brand-accent hover:underline text-caption"
                    >
                      Verify
                    </a>
                  )}
                </span>
                {provider.yearsExperience && (
                  <span>
                    <span className="text-ink-tertiary">Experience:</span>{' '}
                    <span className="font-medium text-ink-primary">{provider.yearsExperience} years</span>
                  </span>
                )}
                {provider.npiNumber && (
                  <span>
                    <span className="text-ink-tertiary">NPI:</span>{' '}
                    <span className="font-medium text-ink-primary">{provider.npiNumber}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main content + sidebar */}
      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10 lg:gap-14">

            {/* LEFT: main content */}
            <div className="space-y-12">

              {/* About */}
              {(provider.bio || provider.tagline) && (
                <div>
                  <h2 className="font-serif text-h3 text-ink-primary mb-4">About {provider.fullName.split(' ')[0]}</h2>
                  {provider.tagline && (
                    <p className="text-body-lg font-serif text-ink-secondary mb-3 italic">{provider.tagline}</p>
                  )}
                  {provider.bio && (
                    <p className="text-body text-ink-secondary leading-relaxed">{provider.bio}</p>
                  )}
                </div>
              )}

              {/* Specialties */}
              {provider.specialties.length > 0 && (
                <div>
                  <h2 className="font-serif text-h3 text-ink-primary mb-4">Specialties</h2>
                  <div className="flex flex-wrap gap-2">
                    {provider.specialties.map((s) => (
                      <span key={s} className="px-4 py-2 rounded-pill bg-brand-accent-soft text-brand-primary text-body-sm font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Treatments offered */}
              {provider.treatments.length > 0 && (
                <div>
                  <h2 className="font-serif text-h3 text-ink-primary mb-4">Treatments offered</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {provider.treatments.map((t) => (
                      <div key={t} className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-surface">
                        <span className="w-5 h-5 rounded-full bg-brand-accent-soft flex items-center justify-center flex-shrink-0">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                        <span className="text-body-sm font-medium text-ink-primary">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Board certifications */}
              {provider.boardCertifications.length > 0 && (
                <div>
                  <h2 className="font-serif text-h3 text-ink-primary mb-4">Board certifications</h2>
                  <ul className="space-y-2">
                    {provider.boardCertifications.map((cert) => (
                      <li key={cert} className="flex items-center gap-3 text-body text-ink-primary">
                        <span className="w-5 h-5 rounded-full bg-brand-accent flex items-center justify-center flex-shrink-0">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                        {cert}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Languages + availability */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {provider.languages.length > 0 && (
                  <div>
                    <h3 className="text-h4 text-ink-primary mb-3">Languages</h3>
                    <div className="flex flex-wrap gap-2">
                      {provider.languages.map((l) => (
                        <span key={l} className="px-3 py-1.5 rounded-pill border border-border text-body-sm text-ink-secondary">
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="text-h4 text-ink-primary mb-3">Availability</h3>
                  <ul className="space-y-1.5">
                    {provider.offersInPerson && (
                      <li className="flex items-center gap-2 text-body-sm text-ink-secondary">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                        In-person appointments
                      </li>
                    )}
                    {provider.offersVirtualConsult && (
                      <li className="flex items-center gap-2 text-body-sm text-ink-secondary">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                        Virtual consultations
                      </li>
                    )}
                    {provider.acceptsNewPatients && (
                      <li className="flex items-center gap-2 text-body-sm text-ink-secondary">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                        Accepting new patients
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Reviews */}
              {reviews.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-serif text-h3 text-ink-primary">Patient reviews</h2>
                    {provider.aggregateRating && (
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="star-row text-[16px]">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
                          <span className="font-bold text-h4 text-ink-primary">{provider.aggregateRating.toFixed(1)}</span>
                        </div>
                        <p className="text-caption text-ink-tertiary">{provider.aggregateRatingCount?.toLocaleString()} reviews</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-5">
                    {reviews.map((r) => (
                      <ReviewCard key={r.id} r={r} />
                    ))}
                  </div>
                </div>
              )}

              {/* Clinic block */}
              <div className="rounded-2xl border border-border bg-surface p-6">
                <h2 className="font-serif text-h3 text-ink-primary mb-4">Practice location</h2>
                <div className="flex items-start gap-4">
                  {provider.clinic.photoUrl && (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                      <Image
                        src={provider.clinic.photoUrl}
                        alt={provider.clinic.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/clinics/${provider.clinic.slug}`}
                      className="font-semibold text-body text-ink-primary hover:text-brand-accent transition"
                    >
                      {provider.clinic.name}
                    </Link>
                    <p className="text-body-sm text-ink-secondary mt-0.5">
                      {provider.clinic.neighborhood ? `${provider.clinic.neighborhood}, ` : ''}
                      {provider.clinic.city}, {provider.clinic.state}
                    </p>
                    <Link
                      href={`/clinics/${provider.clinic.slug}`}
                      className="mt-3 inline-flex items-center gap-1.5 text-body-sm text-brand-accent hover:underline"
                    >
                      View clinic profile
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                    </Link>
                  </div>
                </div>
              </div>

            </div>

            {/* RIGHT: sidebar */}
            <div className="space-y-5">

              {/* Book CTA */}
              <div id="book" className="rounded-2xl border border-border bg-surface-canvas shadow-md p-6 scroll-mt-24">
                <h3 className="font-serif text-h3 text-ink-primary mb-2">Book a consult</h3>
                <p className="text-body-sm text-ink-secondary mb-5">
                  Reach out to {provider.fullName.split(' ')[0]} directly. Most consultations are free.
                </p>
                <div className="space-y-2.5">
                  {provider.websiteUrl && (
                    <a
                      href={provider.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 bg-brand-primary text-white rounded-pill py-3 text-body-sm font-semibold hover:opacity-90 transition"
                    >
                      Book on their website
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                    </a>
                  )}
                  {provider.phoneDirect && (
                    <a
                      href={`tel:${provider.phoneDirect}`}
                      className="flex w-full items-center justify-center gap-2 border border-border rounded-pill py-3 text-body-sm font-medium text-ink-primary hover:bg-surface hover:border-brand-accent transition"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.81 19.79 19.79 0 01.01 2.18 2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92z" />
                      </svg>
                      {provider.phoneDirect}
                    </a>
                  )}
                  {provider.email && (
                    <a
                      href={`mailto:${provider.email}`}
                      className="flex w-full items-center justify-center gap-2 border border-border rounded-pill py-3 text-body-sm font-medium text-ink-primary hover:bg-surface hover:border-brand-accent transition"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                      </svg>
                      Email
                    </a>
                  )}
                </div>
              </div>

              {/* Pricing */}
              {(provider.pricingBotoxPerUnit || provider.pricingFillerPerSyringe || provider.pricingConsultation || provider.startingPrice) && (
                <div className="rounded-2xl border border-border bg-surface p-5">
                  <h3 className="text-h4 text-ink-primary mb-4">Pricing</h3>
                  <div className="space-y-3">
                    {provider.startingPrice && (
                      <PriceRow label="Starting from" value={`$${provider.startingPrice}`} />
                    )}
                    {provider.pricingBotoxPerUnit && (
                      <PriceRow label="Botox" value={`$${provider.pricingBotoxPerUnit} / unit`} />
                    )}
                    {provider.pricingFillerPerSyringe && (
                      <PriceRow label="Filler" value={`$${provider.pricingFillerPerSyringe} / syringe`} />
                    )}
                    {provider.pricingConsultation !== undefined && (
                      <PriceRow
                        label="Consultation"
                        value={provider.pricingConsultation === 0 ? 'Free' : `$${provider.pricingConsultation}`}
                      />
                    )}
                  </div>
                  <p className="text-caption text-ink-tertiary mt-4">
                    Prices are estimates. Confirm with the provider before booking.
                  </p>
                </div>
              )}

              {/* Trust signals */}
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                <h3 className="text-h4 text-ink-primary">Verified by injector.world</h3>
                {[
                  'License number checked against state database',
                  'Credentials independently confirmed',
                  'Reviews verified and moderated',
                  'Zero paid placements or promoted listings',
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

              {/* Social */}
              {(provider.instagramUrl || provider.tiktokUrl || provider.websiteUrl) && (
                <div className="rounded-2xl border border-border bg-surface p-5">
                  <h3 className="text-h4 text-ink-primary mb-3">Links</h3>
                  <div className="space-y-2">
                    {provider.websiteUrl && (
                      <ExternalLink href={provider.websiteUrl} label="Website" />
                    )}
                    {provider.instagramUrl && (
                      <ExternalLink href={provider.instagramUrl} label="Instagram" />
                    )}
                    {provider.tiktokUrl && (
                      <ExternalLink href={provider.tiktokUrl} label="TikTok" />
                    )}
                    {provider.linkedinUrl && (
                      <ExternalLink href={provider.linkedinUrl} label="LinkedIn" />
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}

function ReviewCard({ r }: { r: ReviewRow }) {
  const stars = Math.round(r.rating)
  const date = r.reviewDate ? new Date(r.reviewDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : ''
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
      {r.responseFromProvider && (
        <div className="mt-3 pt-3 border-t border-border-subtle">
          <p className="text-caption text-ink-tertiary font-semibold mb-1">Response from provider</p>
          <p className="text-body-sm text-ink-secondary italic">{r.responseFromProvider}</p>
        </div>
      )}
    </div>
  )
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-body-sm">
      <span className="text-ink-secondary">{label}</span>
      <span className="font-semibold text-ink-primary">{value}</span>
    </div>
  )
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-body-sm text-ink-secondary hover:text-brand-accent transition"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
      </svg>
      {label}
    </a>
  )
}
