import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ClinicPhotoCarousel } from '@/components/clinics/ClinicPhotoCarousel'
import { ClinicSaveButton } from '@/components/clinics/ClinicSaveButton'
import { ClinicReviews } from '@/components/clinics/ClinicReviews'
import { ClinicMap } from '@/components/clinics/ClinicMap'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import { BookConsultButton } from '@/components/booking/BookConsultButton'
import { LockedContactInfo } from '@/components/clinics/LockedContactInfo'
import {
  getAllClinicParams,
  getClinicBySlug,
  getClinicReviews,
  type ClinicDetail,
  type ClinicHours,
  type ClinicProvider,
  type ClinicReviewRow,
} from '@/lib/clinic-queries'

export const revalidate = 300

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

export async function generateStaticParams() {
  try {
    return await getAllClinicParams()
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; city: string; slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const clinic = await getClinicBySlug(slug)
  if (!clinic) return {}

  const description = clinic.description
    ? truncate(clinic.description, 155)
    : `${clinic.clinicName} is a ${formatClinicType(clinic.clinicType)} in ${clinic.city}, ${clinic.state} with ${clinic.aggregateRatingCount ?? 0} patient reviews and ${clinic.providers.length} injectors.`

  return {
    title: `${clinic.clinicName} - ${clinic.city}, ${clinic.state}`,
    description,
    alternates: {
      canonical: `${SITE_URL}/clinics/${clinic.stateSlug}/${clinic.citySlug}/${clinic.slug}`,
    },
    openGraph: {
      type: 'website',
      title: `${clinic.clinicName} - ${clinic.city}, ${clinic.state}`,
      description,
      images: clinic.photoUrls[0] ? [clinic.photoUrls[0]] : [],
    },
    robots: clinic.status !== 'published' || clinic.cityMarketNoindex
      ? { index: false, follow: true }
      : undefined,
  }
}

export default async function ClinicDetailPage({
  params,
}: {
  params: Promise<{ state: string; city: string; slug: string }>
}) {
  const { slug } = await params
  const clinic = await getClinicBySlug(slug)
  if (!clinic) notFound()

  const reviews = await getClinicReviews(clinic.id)
  const canonicalUrl = `${SITE_URL}/clinics/${clinic.stateSlug}/${clinic.citySlug}/${clinic.slug}`
  const schema = buildSchema(clinic, reviews, canonicalUrl)
  const hasCoords = hasValidCoordinates(clinic.latitude, clinic.longitude)
  const address = fullAddress(clinic)

  return (
    <>
      {schema.map((item, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJson(item) }}
        />
      ))}

      <Header />

      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex min-w-0 items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <Link href="/clinics" className="hover:text-ink-primary transition">Clinics</Link>
            <span>/</span>
            <Link href={`/${clinic.stateSlug}`} className="hover:text-ink-primary transition">
              {titleFromSlug(clinic.stateSlug)}
            </Link>
            <span>/</span>
            <Link href={`/${clinic.stateSlug}/${clinic.citySlug}`} className="hover:text-ink-primary transition">
              {clinic.city}
            </Link>
            <span>/</span>
            <span className="truncate text-ink-primary">{clinic.clinicName}</span>
          </nav>
        </div>
      </div>

      <main className="bg-surface-canvas">
        <section className="border-b border-border bg-surface-canvas py-8 md:py-12">
          <div className="max-canvas">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:items-start">
              <ClinicPhotoCarousel clinicName={clinic.clinicName} photoUrls={clinic.photoUrls} />

              <div className="space-y-5">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {clinic.clinicType && (
                      <span className="rounded-pill border border-border bg-surface px-3 py-1 text-caption font-semibold text-ink-secondary">
                        {formatClinicType(clinic.clinicType)}
                      </span>
                    )}
                  </div>
                  <h1 className="font-serif text-h1-m leading-tight text-ink-primary md:text-h1">
                    {clinic.clinicName}
                  </h1>
                  {clinic.aggregateRating && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="star-row text-[15px] text-state-star">
                        {'★'.repeat(Math.round(clinic.aggregateRating))}
                        {'☆'.repeat(5 - Math.round(clinic.aggregateRating))}
                      </span>
                      <span className="font-semibold text-body-sm text-ink-primary">
                        {clinic.aggregateRating.toFixed(1)}
                      </span>
                      <span className="text-body-sm text-ink-secondary">
                        ({(clinic.aggregateRatingCount ?? 0).toLocaleString()} reviews)
                      </span>
                    </div>
                  )}
                  <p className="mt-4 text-body text-ink-secondary">{address}</p>
                  {clinic.googleMapsUrl && (
                    <a
                      href={clinic.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-body-sm font-semibold text-brand-accent hover:underline"
                    >
                      Get directions
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <ClinicSaveButton clinicId={clinic.id} />
                  <BookConsultButton
                    kind="clinic"
                    targetId={Number(clinic.id)}
                    targetName={clinic.clinicName}
                    treatmentsOffered={clinic.treatmentsOffered}
                    className="inline-flex min-h-11 items-center justify-center rounded-pill bg-brand-primary px-5 py-2.5 text-body-sm font-semibold text-surface-canvas transition hover:opacity-90"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-surface py-5">
          <div className="max-canvas">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <LockedContactInfo
                clinicId={clinic.id}
                clinicName={clinic.clinicName}
                hasPhone={!!clinic.phone}
                hasEmail={!!clinic.email}
                variant="quick"
              />
              <QuickInfoItem label="Website" value={clinic.websiteUrl ? 'Visit website' : 'Not listed'} href={clinic.websiteUrl || undefined} external />
              <QuickInfoItem label="Hours today" value={hoursToday(clinic.hoursJson)} />
            </div>
          </div>
        </section>

        <section className="section-pad">
          <div className="max-canvas">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
              <div className="space-y-14">
                {clinic.description && (
                  <section>
                    <h2 className="mb-4 font-serif text-h3 text-ink-primary">Overview</h2>
                    <p className="text-body leading-relaxed text-ink-secondary">{clinic.description}</p>
                    <div className="mt-5 flex flex-wrap gap-3 text-body-sm text-ink-secondary">
                      {clinic.yearEstablished && (
                        <span className="rounded-pill border border-border px-3 py-1.5">
                          Established {clinic.yearEstablished}
                        </span>
                      )}
                      {clinic.serviceType && (
                        <span className="rounded-pill border border-border px-3 py-1.5">
                          {clinic.serviceType}
                        </span>
                      )}
                      {clinic.county && (
                        <span className="rounded-pill border border-border px-3 py-1.5">
                          Located in {clinic.county}
                        </span>
                      )}
                    </div>
                  </section>
                )}

                {(clinic.treatmentsOffered.length > 0 || clinic.brandsOffered.length > 0) && (
                  <section>
                    <h2 className="mb-5 font-serif text-h3 text-ink-primary">
                      Treatments / Services Offered
                    </h2>
                    {clinic.treatmentsOffered.length > 0 && (
                      <div className="mb-5">
                        <p className="mb-3 text-caption font-semibold uppercase tracking-[0.08em] text-ink-tertiary">Services</p>
                        <div className="flex flex-wrap gap-2">
                          {clinic.treatmentsOffered.map((treatment) => (
                            <Link
                              key={treatment.id}
                              href={`/services/${treatment.slug}/${clinic.stateSlug}/${clinic.citySlug}`}
                              className="rounded-pill border border-border px-4 py-2 text-body-sm font-medium text-ink-primary transition hover:border-brand-accent hover:text-brand-accent"
                            >
                              {treatment.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {clinic.brandsOffered.length > 0 && (
                      <div>
                        <p className="mb-3 text-caption font-semibold uppercase tracking-[0.08em] text-ink-tertiary">Brands</p>
                        <div className="flex flex-wrap gap-2">
                          {clinic.brandsOffered.map((brand) => (
                            <Link
                              key={brand.id}
                              href={`/brands/${brand.slug}`}
                              className="rounded-pill border border-border px-4 py-2 text-body-sm font-medium text-ink-primary transition hover:border-brand-accent hover:text-brand-accent"
                            >
                              {brand.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {clinic.providers.length > 0 && (
                  <section>
                    <h2 className="mb-6 font-serif text-h3 text-ink-primary">
                      Injectors at {clinic.clinicName}
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      {clinic.providers.map((provider) => (
                        <ProviderCard
                          key={provider.id}
                          provider={provider}
                          stateSlug={clinic.stateSlug}
                          citySlug={clinic.citySlug}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {reviews.length > 0 && (
                  <ClinicReviews
                    reviews={reviews}
                    aggregateRating={clinic.aggregateRating}
                    aggregateRatingCount={clinic.aggregateRatingCount}
                  />
                )}

                {hasCoords && (
                  <section>
                    <h2 className="mb-5 font-serif text-h3 text-ink-primary">Map</h2>
                    <ClinicMap
                      clinicName={clinic.clinicName}
                      latitude={clinic.latitude}
                      longitude={clinic.longitude}
                      directionsUrl={clinic.directionsUrl || clinic.googleMapsUrl}
                    />
                  </section>
                )}

                <section className="rounded-2xl border border-border bg-surface p-6 md:p-8">
                  <h2 className="mb-3 font-serif text-h3 text-ink-primary">Book a consult</h2>
                  <p className="mb-5 text-body-sm text-ink-secondary">
                    Your request goes to the clinic. We do not store payment details. Free to inquire.
                  </p>
                  <BookConsultButton
                    kind="clinic"
                    targetId={Number(clinic.id)}
                    targetName={clinic.clinicName}
                    treatmentsOffered={clinic.treatmentsOffered}
                  />
                </section>

                {clinic.faqs.length > 0 && (
                  <section>
                    <h2 className="mb-5 font-serif text-h3 text-ink-primary">FAQs</h2>
                    <div className="space-y-3">
                      {clinic.faqs.map((faq) => (
                        <FaqItem key={faq.id} question={faq.question} answer={faq.answer} />
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
                {clinic.photoUrls.length > 1 && (
                  <div className="overflow-hidden rounded-2xl border border-border">
                    <SideGallery photoUrls={clinic.photoUrls} clinicName={clinic.clinicName} />
                  </div>
                )}

                <SideCard title="Clinic details">
                  <InfoRow label="Address" value={address} />
                  <LockedContactInfo
                    clinicId={clinic.id}
                    clinicName={clinic.clinicName}
                    hasPhone={!!clinic.phone}
                    hasEmail={!!clinic.email}
                    variant="sidebar"
                  />
                  {clinic.websiteUrl && <InfoRow label="Website" value="Visit website" href={clinic.websiteUrl} external />}
                  {clinic.bookingUrl && <InfoRow label="Booking site" value="Listed in admin" />}
                  {(clinic.instagramUrl || clinic.tiktokUrl || clinic.facebookUrl) && (
                    <div className="pt-1">
                      <p className="mb-2 text-caption font-semibold uppercase tracking-[0.08em] text-ink-tertiary">Social</p>
                      <div className="flex gap-3">
                        {clinic.instagramUrl && (
                          <a href={clinic.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                            className="text-ink-tertiary transition hover:text-brand-accent">
                            <InstagramIcon />
                          </a>
                        )}
                        {clinic.tiktokUrl && (
                          <a href={clinic.tiktokUrl} target="_blank" rel="noopener noreferrer" aria-label="TikTok"
                            className="text-ink-tertiary transition hover:text-brand-accent">
                            <TikTokIcon />
                          </a>
                        )}
                        {clinic.facebookUrl && (
                          <a href={clinic.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                            className="text-ink-tertiary transition hover:text-brand-accent">
                            <FacebookIcon />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </SideCard>

                {clinic.hoursJson && (
                  <SideCard title="Hours of operation">
                    <HoursTable hours={clinic.hoursJson} />
                  </SideCard>
                )}

                {(clinic.amenities || clinic.paymentMethods || clinic.acceptsInsurance) && (
                  <SideCard title="Practice notes">
                    {clinic.acceptsInsurance && <InfoRow label="Insurance" value="Accepts insurance" />}
                    {clinic.amenities && <InfoRow label="Amenities" value={clinic.amenities} />}
                    {clinic.paymentMethods && <InfoRow label="Payment" value={clinic.paymentMethods} />}
                  </SideCard>
                )}
              </aside>
            </div>
          </div>
        </section>

        {!clinic.claimed && (
          <section className="border-y border-border bg-surface py-12">
            <div className="max-canvas text-center">
              <h2 className="font-serif text-h3 text-ink-primary">Are you the clinic owner?</h2>
              <p className="mx-auto mt-3 max-w-2xl text-body-sm text-ink-secondary">
                Claim this profile to update info and respond to reviews.
              </p>
              <Link
                href={`/claim/clinic/${clinic.slug}`}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-pill bg-brand-primary px-6 py-3 text-body-sm font-semibold text-surface-canvas transition hover:opacity-90"
              >
                Claim this profile
              </Link>
            </div>
          </section>
        )}

        {clinic.relatedClinics.length > 0 && (
          <section className="section-pad bg-surface-canvas">
            <div className="max-canvas">
              <h2 className="mb-6 font-serif text-h3 text-ink-primary">Other clinics in {clinic.city}</h2>
              <div className="grid gap-5 md:grid-cols-3">
                {clinic.relatedClinics.map((related) => (
                  <DirectoryClinicCard key={related.id} c={related} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </>
  )
}

function QuickInfoItem({
  label,
  value,
  href,
  external = false,
}: {
  label: string
  value: string
  href?: string
  external?: boolean
}) {
  const content = (
    <>
      <span className="block text-caption font-semibold uppercase tracking-[0.08em] text-ink-tertiary">{label}</span>
      <span className="mt-1 block truncate text-body-sm font-semibold text-ink-primary">{value}</span>
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className="rounded-xl border border-border bg-surface-canvas px-4 py-3 transition hover:border-brand-accent"
      >
        {content}
      </a>
    )
  }

  return <div className="rounded-xl border border-border bg-surface-canvas px-4 py-3">{content}</div>
}

function ProviderCard({
  provider,
  stateSlug,
  citySlug,
}: {
  provider: ClinicProvider
  stateSlug: string
  citySlug: string
}) {
  const stars = Math.max(0, Math.min(5, Math.round(provider.aggregateRating || 0)))
  return (
    <article className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-canvas">
          {provider.profilePhotoUrl ? (
            <Image src={provider.profilePhotoUrl} alt={provider.fullName} fill sizes="64px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ink-tertiary">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
                <path d="M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-body text-ink-primary">
            {provider.fullName}{provider.credentials ? `, ${provider.credentials}` : ''}
          </h3>
          <p className="mt-0.5 text-body-sm text-ink-secondary">{provider.title}</p>
          {provider.aggregateRating && (
            <div className="mt-2 flex items-center gap-2">
              <span className="star-row text-[12px] text-state-star">
                {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
              </span>
              <span className="text-caption text-ink-secondary">
                {provider.aggregateRating.toFixed(1)}
                {provider.aggregateRatingCount ? ` (${provider.aggregateRatingCount})` : ''}
              </span>
            </div>
          )}
        </div>
      </div>
      {provider.treatments.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {provider.treatments.slice(0, 3).map((treatment) => (
            <span key={treatment} className="rounded-pill border border-border px-2.5 py-1 text-[10px] font-semibold text-ink-secondary">
              {treatment}
            </span>
          ))}
        </div>
      )}
      <Link
        href={`/injectors/${stateSlug}/${citySlug}/${provider.slug}`}
        className="mt-4 inline-flex items-center gap-1.5 text-body-sm font-semibold text-brand-accent hover:underline"
      >
        View profile
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>
    </article>
  )
}

function formatHoursDisplay(raw: string): string {
  // Convert "17:00 - 20:00" or "9:00 - 17:00" to "9am - 5pm"
  const parts = raw.split(/\s*[-–]\s*/)
  if (parts.length !== 2) return raw
  const fmt = (t: string): string | null => {
    const m = t.trim().match(/^(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?$/i)
    if (!m) return null
    let h = Number(m[1])
    const min = Number(m[2] || 0)
    const p = m[3]?.toLowerCase()
    if (p === 'pm' && h < 12) h += 12
    else if (p === 'am' && h === 12) h = 0
    const period = h >= 12 ? 'pm' : 'am'
    const hour12 = h % 12 || 12
    return min === 0 ? `${hour12}${period}` : `${hour12}:${String(min).padStart(2, '0')}${period}`
  }
  const start = fmt(parts[0])
  const end = fmt(parts[1])
  if (!start || !end) return raw
  return `${start} - ${end}`
}

function HoursTable({ hours }: { hours: ClinicHours }) {
  const todayKey = DAY_KEYS[(new Date().getDay() + 6) % 7]
  return (
    <div className="-m-5 overflow-hidden rounded-b-2xl">
      <table className="w-full text-left text-body-sm">
        <tbody>
          {DAY_KEYS.map((day) => {
            const raw = hours[day] || 'Closed'
            const closed = /^closed$/i.test(raw)
            const display = closed ? 'Closed' : formatHoursDisplay(raw)
            const isToday = day === todayKey
            return (
              <tr key={day} className={isToday ? 'border-l-4 border-brand-accent bg-brand-accent/5' : 'border-l-4 border-transparent'}>
                <th className="border-b border-border px-4 py-2.5 font-semibold text-ink-primary">{DAY_LABELS[day]}</th>
                <td className={`border-b border-border px-4 py-2.5 text-right ${closed ? 'text-ink-tertiary' : 'text-ink-secondary'}`}>
                  {display}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SideGallery({ photoUrls, clinicName }: { photoUrls: string[]; clinicName: string }) {
  // Shows photos 2..N as a simple scroll strip (no JS needed for basic carousel)
  const galleryPhotos = photoUrls.slice(1) // skip first — it's the cover
  return (
    <div className="flex snap-x snap-mandatory overflow-x-auto">
      {galleryPhotos.map((url, i) => (
        <div key={i} className="relative h-48 w-full shrink-0 snap-start">
          <Image src={url} alt={`${clinicName} photo ${i + 2}`} fill sizes="340px" className="object-cover" />
        </div>
      ))}
    </div>
  )
}

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.01a8.16 8.16 0 004.78 1.52V7.08a4.85 4.85 0 01-1.01-.39z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group overflow-hidden rounded-xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition hover:bg-surface-canvas">
        <span className="font-medium text-body text-ink-primary">{question}</span>
        <svg className="h-5 w-5 shrink-0 text-ink-tertiary transition-transform group-open:rotate-180 group-open:text-brand-accent"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="border-t border-border-subtle px-5 pb-5 pt-3 text-body-sm leading-relaxed text-ink-secondary">
        {answer}
      </div>
    </details>
  )
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-4 text-h4 text-ink-primary">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function InfoRow({
  label,
  value,
  href,
  external = false,
}: {
  label: string
  value: string
  href?: string
  external?: boolean
}) {
  const valueNode = href ? (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="text-brand-accent hover:underline"
    >
      {value}
    </a>
  ) : (
    <span>{value}</span>
  )

  return (
    <div className="text-body-sm">
      <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-tertiary">{label}</p>
      <p className="mt-1 text-ink-secondary">{valueNode}</p>
    </div>
  )
}

function buildSchema(clinic: ClinicDetail, reviews: ClinicReviewRow[], canonicalUrl: string): object[] {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Clinics', item: `${SITE_URL}/clinics` },
      { '@type': 'ListItem', position: 3, name: titleFromSlug(clinic.stateSlug), item: `${SITE_URL}/${clinic.stateSlug}` },
      { '@type': 'ListItem', position: 4, name: clinic.city, item: `${SITE_URL}/${clinic.stateSlug}/${clinic.citySlug}` },
      { '@type': 'ListItem', position: 5, name: clinic.clinicName, item: canonicalUrl },
    ],
  }

  const medicalBusiness: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MedicalBusiness',
    name: clinic.clinicName,
    description: clinic.description || clinic.tagline,
    image: clinic.photoUrls,
    url: canonicalUrl,
    telephone: clinic.phone,
    email: clinic.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: [clinic.addressLine1, clinic.addressLine2].filter(Boolean).join(', '),
      addressLocality: clinic.city,
      addressRegion: clinic.state,
      postalCode: clinic.zip,
      addressCountry: 'US',
    },
    geo: hasValidCoordinates(clinic.latitude, clinic.longitude)
      ? {
          '@type': 'GeoCoordinates',
          latitude: clinic.latitude,
          longitude: clinic.longitude,
        }
      : undefined,
    openingHours: openingHoursSchema(clinic.hoursJson),
    priceRange: clinic.startingPrice ? `From $${clinic.startingPrice}` : undefined,
  }

  if (clinic.aggregateRating) {
    medicalBusiness.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: clinic.aggregateRating,
      reviewCount: clinic.aggregateRatingCount || reviews.length,
      bestRating: 5,
      worstRating: 1,
    }
  }

  if (reviews.length > 0) {
    medicalBusiness.review = reviews.slice(0, 5).map((review) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: review.reviewerFirstName || 'Patient' },
      reviewRating: { '@type': 'Rating', ratingValue: review.rating, bestRating: 5 },
      reviewBody: review.reviewText,
      datePublished: review.reviewDate,
    }))
  }

  const items: object[] = [breadcrumb, stripUndefined(medicalBusiness)]

  if (clinic.faqs.length > 0) {
    items.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: clinic.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    })
  }

  return items
}

function fullAddress(clinic: ClinicDetail): string {
  return [
    clinic.addressLine1,
    clinic.addressLine2,
    clinic.neighborhood,
    clinic.city,
    `${clinic.state} ${clinic.zip}`.trim(),
  ].filter(Boolean).join(', ')
}

function hasValidCoordinates(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0
}

function hoursToday(hours?: ClinicHours): string {
  if (!hours) return 'Hours not listed'
  const todayIndex = (new Date().getDay() + 6) % 7
  const today = DAY_KEYS[todayIndex]
  const value = hours[today]
  if (!value || /^closed$/i.test(value)) return nextOpening(hours, todayIndex)

  const range = parseHoursRange(value)
  if (!range) return value

  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  if (minutes < range.open) return `Opens ${formatMinutes(range.open)} today`
  if (minutes <= range.close) return `Open until ${formatMinutes(range.close)}`
  return nextOpening(hours, todayIndex)
}

function nextOpening(hours: ClinicHours, todayIndex: number): string {
  for (let offset = 1; offset <= 7; offset++) {
    const dayIndex = (todayIndex + offset) % 7
    const value = hours[DAY_KEYS[dayIndex]]
    if (!value || /^closed$/i.test(value)) continue
    const range = parseHoursRange(value)
    if (!range) return offset === 1 ? `Opens tomorrow` : `Opens ${DAY_LABELS[DAY_KEYS[dayIndex]]}`
    return offset === 1
      ? `Opens ${formatMinutes(range.open)} tomorrow`
      : `Opens ${formatMinutes(range.open)} ${DAY_LABELS[DAY_KEYS[dayIndex]]}`
  }
  return 'Closed'
}

function parseHoursRange(value: string): { open: number; close: number } | null {
  const match = value.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (!match) return null
  const open = toMinutes(match[1], match[2], match[3] || match[6])
  const close = toMinutes(match[4], match[5], match[6])
  if (open == null || close == null) return null
  return { open, close }
}

function toMinutes(hourText: string, minuteText?: string, period?: string): number | null {
  let hour = Number(hourText)
  const minute = Number(minuteText || 0)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  const p = period?.toLowerCase()
  if (p === 'pm' && hour < 12) hour += 12
  if (p === 'am' && hour === 12) hour = 0
  return hour * 60 + minute
}

function formatMinutes(total: number): string {
  const hour24 = Math.floor(total / 60)
  const minute = total % 60
  const period = hour24 >= 12 ? 'pm' : 'am'
  const hour = hour24 % 12 || 12
  return minute === 0 ? `${hour}${period}` : `${hour}:${String(minute).padStart(2, '0')}${period}`
}

function openingHoursSchema(hours?: ClinicHours): string[] | undefined {
  if (!hours) return undefined
  const dayCodes: Record<(typeof DAY_KEYS)[number], string> = {
    mon: 'Mo',
    tue: 'Tu',
    wed: 'We',
    thu: 'Th',
    fri: 'Fr',
    sat: 'Sa',
    sun: 'Su',
  }
  const rows = DAY_KEYS
    .map((day) => {
      const value = hours[day]
      if (!value || /^closed$/i.test(value)) return null
      return `${dayCodes[day]} ${value}`
    })
    .filter(Boolean) as string[]
  return rows.length > 0 ? rows : undefined
}

function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatClinicType(type?: string): string {
  const labels: Record<string, string> = {
    medspa: 'med spa',
    dermatology: 'dermatology clinic',
    'plastic-surgery': 'plastic surgery clinic',
    'dental-aesthetics': 'dental aesthetics clinic',
    other: 'aesthetic clinic',
  }
  return type ? labels[type] ?? 'aesthetic clinic' : 'aesthetic clinic'
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trim()}...`
}

function stripUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined))
}

function safeJson(value: object): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
