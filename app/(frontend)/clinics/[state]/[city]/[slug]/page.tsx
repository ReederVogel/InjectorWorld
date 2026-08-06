import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ClinicSaveButton } from '@/components/clinics/ClinicSaveButton'
import { ShareButton } from '@/components/clinics/ShareButton'
import { OwnerCompletionBanner } from '@/components/clinics/OwnerCompletionBanner'
import { computeClinicCompleteness } from '@/lib/clinic-completeness'
import { ClinicMapLazy } from '@/components/clinics/ClinicMapLazy'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import { PracticeNotes } from '@/components/clinics/PracticeNotes'
import { TrackEvent } from '@/components/analytics/TrackEvent'
import { FaqAccordionItem } from '@/components/shared/FaqAccordionItem'
import {
  getAllClinicParams,
  getClinicBySlug,
  type ClinicDetail,
  type ClinicFaq,
  type ClinicHours,
} from '@/lib/clinic-queries'
import { formatPhoneDisplay, toTelHref } from '@/lib/format-phone'
import { ClinicHoursBar } from '@/components/clinics/ClinicHoursBar'
import { ClinicCoverPhoto } from '@/components/clinics/ClinicCoverPhoto'
import { ClinicPhotoGallery } from '@/components/clinics/ClinicPhotoGallery'
import { BookPill } from '@/components/clinics/BookPill'
import { ConsultationForm } from '@/components/booking/ConsultationForm'

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
    : `${clinic.clinicName} is a ${formatClinicType(clinic.clinicType)} in ${clinic.city}, ${clinic.state} with ${clinic.aggregateRatingCount ?? 0} patient reviews.`

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
    robots: clinic.status !== 'published'
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

  const canonicalUrl = `${SITE_URL}/clinics/${clinic.stateSlug}/${clinic.citySlug}/${clinic.slug}`
  const faqs = clinic.faqs.length > 0 ? clinic.faqs : buildFallbackFaqs(clinic)
  const schema = buildSchema(clinic, canonicalUrl, faqs)
  const hasCoords = hasValidCoordinates(clinic.latitude, clinic.longitude)
  const address = fullAddress(clinic)
  const updatedLabel = clinic.updatedAt
    ? new Date(clinic.updatedAt).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null
  const missingProfileLabels = computeClinicCompleteness({
    photos: clinic.photoUrls,
    servicesOffered: clinic.servicesOffered,
    phone: clinic.phone,
    email: clinic.email,
    websiteUrl: clinic.websiteUrl,
    description: clinic.description,
    hoursJson: clinic.hoursJson,
  })
    .filter((step) => !step.done)
    .map((step) => step.label)

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
      <TrackEvent type="clinic_view" entityType="clinic" entityId={Number(clinic.id)} />

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
            {/* 50/50 as of 2026-08-06 (client request): the cover ends on the
                vertical midline of the page rather than running wider. */}
            <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
              <ClinicCoverPhoto clinicName={clinic.clinicName} photoUrls={clinic.photoUrls} />

              <div className="space-y-5">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {clinic.clinicType && (
                      <span className="rounded-control border border-border bg-surface px-3 py-1 text-caption font-semibold text-ink-secondary">
                        {clinicTypeChipLabel(clinic.clinicType)}
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
                  {updatedLabel && (
                    <p className="mt-2 text-caption text-ink-tertiary">Updated: {updatedLabel}</p>
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

                  {/* Contact moved into the hero 2026-08-06 (client request), and
                      un-gated with it: phone, website and social are public for
                      everyone. Email is the sole exception and only appears once a
                      claimed clinic opts in via emailPublic. The old quick-info bar
                      and the sidebar "Clinic details" card both held this and are
                      gone. */}
                  <div className="mt-5 space-y-1.5 text-body text-ink-secondary">
                    {clinic.phone && (
                      <p>
                        Phone:{' '}
                        <a href={`tel:${toTelHref(clinic.phone)}`} className="font-medium text-brand-accent hover:underline">
                          {formatPhoneDisplay(clinic.phone)}
                        </a>
                      </p>
                    )}
                    {clinic.websiteUrl && (
                      <p>
                        Website:{' '}
                        <a
                          href={clinic.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-brand-accent hover:underline"
                        >
                          {displayUrl(clinic.websiteUrl)}
                        </a>
                      </p>
                    )}
                    {clinic.email && clinic.claimed && clinic.emailPublic && (
                      <p>
                        Email:{' '}
                        <a href={`mailto:${clinic.email}`} className="font-medium text-brand-accent hover:underline">
                          {clinic.email}
                        </a>
                      </p>
                    )}
                  </div>

                  <ClinicSocialRow clinic={clinic} />
                </div>

                {/* The hero "Book a consultation" button went 2026-08-06: the
                    sidebar form covers desktop and BookPill covers mobile, so it
                    was a third route to the same place. */}
                <div className="flex flex-wrap gap-3">
                  <ClinicSaveButton clinicId={clinic.id} />
                  <ShareButton clinicId={Number(clinic.id)} clinicName={clinic.clinicName} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {clinic.hoursJson && <ClinicHoursBar hours={clinic.hoursJson} />}

        <section className="section-pad">
          <div className="max-canvas">
            {/* Left column sections are separated by a hairline, matching the
                prototype. Deliberately no eyebrow labels above the headings
                ("Gallery", "Menu", "Good to know" and friends): client dropped
                them 2026-08-06. */}
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
              <div className="[&>section]:border-b [&>section]:border-border-subtle [&>section]:pb-12 [&>section]:mb-12 [&>section:last-child]:border-b-0 [&>section:last-child]:pb-0 [&>section:last-child]:mb-0">
                {clinic.description && (
                  <section>
                    <h2 className="mb-4 font-serif text-h3 text-ink-primary">Overview</h2>
                    <p className="text-body leading-relaxed text-ink-secondary">{clinic.description}</p>
                    <div className="mt-5 flex flex-wrap gap-3 text-body-sm text-ink-secondary">
                      {clinic.yearEstablished && (
                        <span className="rounded-control border border-border px-3 py-1.5">
                          Established {clinic.yearEstablished}
                        </span>
                      )}
                      {clinic.serviceType && (
                        <span className="rounded-control border border-border px-3 py-1.5">
                          {clinic.serviceType}
                        </span>
                      )}
                      {clinic.county && (
                        <span className="rounded-control border border-border px-3 py-1.5">
                          Located in {clinic.county}
                        </span>
                      )}
                    </div>
                  </section>
                )}

                {(clinic.servicesOffered.length > 0 || clinic.brandsOffered.length > 0) && (
                  <section>
                    <h2 className="mb-5 font-serif text-h3 text-ink-primary">
                      Treatments / Services Offered
                    </h2>
                    {clinic.servicesOffered.length > 0 && (
                      <div className="mb-5">
                        <p className="mb-3 text-caption font-semibold uppercase tracking-[0.08em] text-ink-tertiary">Services</p>
                        <div className="flex flex-wrap gap-2">
                          {clinic.servicesOffered.map((treatment) => (
                            <Link
                              key={treatment.id}
                              href={`/services/${treatment.slug}/${clinic.stateSlug}/${clinic.citySlug}`}
                              className="rounded-control border border-border px-4 py-2 text-body-sm font-medium text-ink-primary transition hover:border-brand-accent hover:text-brand-accent"
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
                              className="rounded-control border border-border px-4 py-2 text-body-sm font-medium text-ink-primary transition hover:border-brand-accent hover:text-brand-accent"
                            >
                              {brand.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {hasCoords && (
                  <section>
                    <h2 className="mb-5 font-serif text-h3 text-ink-primary">Map</h2>
                    <ClinicMapLazy
                      clinicName={clinic.clinicName}
                      latitude={clinic.latitude}
                      longitude={clinic.longitude}
                      directionsUrl={clinic.directionsUrl || clinic.googleMapsUrl}
                    />
                  </section>
                )}

                {/* The "Book a consult" card that sat here is gone: the sidebar
                    now carries the real form, so this was a duplicate CTA. */}

                {clinic.photoUrls.length > 0 && (
                  <section>
                    <h2 className="mb-5 font-serif text-h3 text-ink-primary">Photos</h2>
                    <ClinicPhotoGallery photoUrls={clinic.photoUrls} clinicName={clinic.clinicName} />
                  </section>
                )}

                {/* Owner card sits between Photos and Practice notes, as in the
                    prototype (moved out of the full-width band 2026-08-06). Only
                    one of these two ever shows: the claim card is for everyone
                    while a clinic is unclaimed, and OwnerCompletionBanner
                    renders null unless the signed-in owner is looking. */}
                {!clinic.claimed && (
                  <section>
                    <div className="rounded-2xl bg-brand-accent-soft p-7 md:p-9">
                      <h2 className="font-serif text-h3 text-ink-primary">Is this your clinic?</h2>
                      <p className="mt-2 max-w-[60ch] text-body-sm text-ink-secondary">
                        Claim this free profile to update your info, add photos and your full service
                        menu, and respond to patient inquiries.
                      </p>
                      <div className="mt-5 flex flex-wrap items-center gap-4">
                        <Link
                          href={`/claim/clinic/${clinic.slug}`}
                          className="inline-flex min-h-11 items-center justify-center rounded-control bg-brand-primary px-6 py-3 text-body-sm font-semibold text-surface-canvas transition hover:opacity-90"
                        >
                          Claim this profile
                        </Link>
                        <span className="text-body-sm text-ink-secondary">Free · Takes about a minute</span>
                      </div>
                    </div>
                  </section>
                )}

                {clinic.claimed && (
                  <OwnerCompletionBanner clinicId={clinic.id} missingLabels={missingProfileLabels} />
                )}

                {(clinic.amenities || clinic.paymentMethods || clinic.acceptsInsurance) && (
                  <section>
                    <h2 className="mb-5 font-serif text-h3 text-ink-primary">Practice notes</h2>
                    <PracticeNotes
                      amenities={clinic.amenities}
                      paymentMethods={clinic.paymentMethods}
                      acceptsInsurance={clinic.acceptsInsurance}
                    />
                  </section>
                )}

                {clinic.reviews.length > 0 && <ReviewsSection clinic={clinic} />}

                {faqs.length > 0 && (
                  <section>
                    <h2 className="mb-5 font-serif text-h3 text-ink-primary">FAQs</h2>
                    <div className="space-y-3">
                      {faqs.map((faq) => (
                        <FaqAccordionItem
                          key={faq.id}
                          question={faq.question}
                          answer={faq.answer}
                          detail={faq.detail}
                          offLabel={faq.offLabel}
                          safetyFlag={faq.safetyFlag}
                          relatedGuideSlug={faq.relatedGuideSlug}
                          relatedGuideTitle={faq.relatedGuideTitle}
                        />
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <a
                    href={`mailto:support@injector.world?subject=${encodeURIComponent(`Issue with ${clinic.clinicName} listing`)}`}
                    className="text-caption text-ink-tertiary underline transition hover:text-ink-primary"
                  >
                    Report an issue with this listing
                  </a>
                </section>
              </div>

              {/* Sidebar is the booking form now (client request 2026-08-06).
                  Everything that used to live here moved into the left column or
                  the hero: gallery, hours, practice notes, contact details. */}
              <aside className="lg:sticky lg:top-24 lg:self-start">
                <div id="book" className="scroll-mt-24 rounded-2xl border border-border bg-surface-canvas p-5 shadow-md">
                  {clinic.aggregateRating && clinic.aggregateRatingCount ? (
                    <span className="inline-flex items-center gap-1.5 rounded-control bg-surface-warm px-3 py-1.5 text-caption font-semibold text-ink-secondary">
                      <span className="text-state-star">★</span>
                      Top-rated in {clinic.city} · {clinic.aggregateRatingCount.toLocaleString()} reviews
                    </span>
                  ) : null}
                  <h2 className="mt-3 font-serif text-h3 text-ink-primary">Book a consultation</h2>
                  <p className="mt-1.5 text-body-sm text-ink-secondary">
                    Your request goes to the clinic. We do not store payment details. Free to inquire.
                  </p>
                  <ConsultationForm
                    kind="clinic"
                    targetId={Number(clinic.id)}
                    targetName={clinic.clinicName}
                    servicesOffered={clinic.servicesOffered}
                    active
                    className="mt-4 space-y-3.5"
                  />
                  <p className="mt-3 text-center text-caption text-ink-tertiary">
                    Clinics typically reply within 1 to 2 business days.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* Both owner cards moved into the left column 2026-08-06. */}

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

      <BookPill />
      <Footer />
    </>
  )
}

/* formatHoursDisplay and HoursTable lived here until 2026-08-06. The sidebar
   "Hours of operation" card was their only caller, and it was a duplicate once
   ClinicHoursBar started carrying the whole week in its dropdown. */

/* ClinicPhotoGallery moved to components/clinics/ClinicPhotoGallery on
   2026-08-06. It had to become a client component to open a lightbox: as a
   server-rendered grid the tiles were unclickable and the "+N" counter was
   decoration. */

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

function LinkedInIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.75V21h-4v-5.6c0-1.34-.03-3.07-1.9-3.07-1.9 0-2.2 1.46-2.2 2.97V21h-4z" />
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23 12s0-3.6-.46-5.33a2.78 2.78 0 00-1.95-1.96C18.88 4.25 12 4.25 12 4.25s-6.88 0-8.59.46A2.78 2.78 0 001.46 6.67C1 8.4 1 12 1 12s0 3.6.46 5.33a2.78 2.78 0 001.95 1.96c1.71.46 8.59.46 8.59.46s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.96C23 15.6 23 12 23 12zM9.75 15.27V8.73L15.5 12z" />
    </svg>
  )
}

/**
 * Every channel we hold for a clinic. LinkedIn and YouTube were added to the
 * schema 2026-08-06 (client request); nothing has been scraped into them yet,
 * so in practice most clinics render Instagram / Facebook / TikTok only.
 */
function ClinicSocialRow({ clinic }: { clinic: ClinicDetail }) {
  const channels = [
    { href: clinic.instagramUrl, label: 'Instagram', icon: <InstagramIcon /> },
    { href: clinic.facebookUrl, label: 'Facebook', icon: <FacebookIcon /> },
    { href: clinic.tiktokUrl, label: 'TikTok', icon: <TikTokIcon /> },
    { href: clinic.linkedinUrl, label: 'LinkedIn', icon: <LinkedInIcon /> },
    { href: clinic.youtubeUrl, label: 'YouTube', icon: <YouTubeIcon /> },
  ].filter((c) => !!c.href)

  if (channels.length === 0) return null

  return (
    <div className="mt-5">
      <p className="mb-2 text-caption font-semibold uppercase tracking-[0.08em] text-ink-tertiary">Social</p>
      <div className="flex flex-wrap gap-2.5">
        {channels.map((c) => (
          <a
            key={c.label}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={c.label}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-canvas text-ink-secondary transition hover:border-brand-accent hover:text-brand-accent"
          >
            {c.icon}
          </a>
        ))}
      </div>
    </div>
  )
}

/** "https://www.davamaesthetics.com/" reads better as "davamaesthetics.com". */
function displayUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
  }
}

function ReviewsSection({ clinic }: { clinic: ClinicDetail }) {
  const reviewCount = clinic.aggregateRatingCount ?? clinic.reviews.length
  const averageLabel = clinic.aggregateRating ? `${clinic.aggregateRating.toFixed(1)} average` : 'Average pending'

  return (
    <section>
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-h3 text-ink-primary">Reviews</h2>
          <p className="mt-1 text-body-sm text-ink-secondary">
            {averageLabel} from {reviewCount.toLocaleString()} approved {reviewCount === 1 ? 'review' : 'reviews'}.
          </p>
        </div>
      </div>
      <div className="space-y-4">
        {clinic.reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </section>
  )
}

function ReviewCard({ review }: { review: ClinicDetail['reviews'][number] }) {
  const displayText = reviewDisplayText(review)

  return (
    <article className="rounded-2xl border border-border bg-surface p-5 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="star-row text-[14px] text-state-star">{renderStars(review.rating)}</span>
            <span className="text-body-sm font-semibold text-ink-primary">{review.rating.toFixed(1)}</span>
            {review.reviewDate && (
              <time className="text-body-sm text-ink-tertiary" dateTime={review.reviewDate}>
                {formatReviewDate(review.reviewDate)}
              </time>
            )}
          </div>
          {review.title && (
            <h3 className="mt-2 text-body font-semibold text-ink-primary">{review.title}</h3>
          )}
        </div>
        {review.serviceTag && (
          <span className="shrink-0 rounded-control border border-border px-3 py-1 text-caption font-semibold text-ink-tertiary">
            {review.serviceTag}
          </span>
        )}
      </div>

      {displayText && (
        <p className="mt-4 text-body-sm leading-relaxed text-ink-secondary">{displayText}</p>
      )}

      {(review.attributionRequired && review.sourcePlatform) && (
        <p className="mt-4 text-caption text-ink-tertiary">
          via{' '}
          {review.sourceUrl ? (
            <a
              href={review.sourceUrl}
              target="_blank"
              rel="nofollow noopener"
              className="font-semibold text-brand-accent hover:underline"
            >
              {formatSourceLabel(review.sourcePlatform)}
            </a>
          ) : (
            <span className="font-semibold">{formatSourceLabel(review.sourcePlatform)}</span>
          )}
        </p>
      )}

      {review.responseFromProvider && (
        <div className="mt-4 rounded-xl border border-border-subtle bg-surface-canvas p-4">
          <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-tertiary">
            Clinic response{review.responseDate ? `, ${formatReviewDate(review.responseDate)}` : ''}
          </p>
          <p className="mt-2 text-body-sm leading-relaxed text-ink-secondary">{review.responseFromProvider}</p>
        </div>
      )}
    </article>
  )
}

function buildSchema(clinic: ClinicDetail, canonicalUrl: string, faqs: ClinicFaq[]): object[] {
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

  const socialLinks = [clinic.websiteUrl, clinic.instagramUrl, clinic.tiktokUrl, clinic.facebookUrl].filter(Boolean)

  const medicalBusiness: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['MedicalBusiness', 'LocalBusiness', 'HealthAndBeautyBusiness'],
    name: clinic.clinicName,
    description: clinic.description || clinic.tagline,
    image: clinic.photoUrls,
    url: canonicalUrl,
    telephone: formatPhoneDisplay(clinic.phone) ?? clinic.phone,
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
    priceRange: clinic.startingPrice ? `From $${clinic.startingPrice}` : '$$',
    sameAs: socialLinks.length > 0 ? socialLinks : undefined,
    paymentAccepted: clinic.paymentMethods
      ? clinic.paymentMethods.split(';').map((v) => v.trim()).filter(Boolean).join(', ')
      : undefined,
  }

  if (clinic.aggregateRating) {
    medicalBusiness.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: clinic.aggregateRating,
      reviewCount: clinic.aggregateRatingCount || 0,
      bestRating: 5,
      worstRating: 1,
    }
  }

  if (clinic.reviews.length > 0) {
    medicalBusiness.review = clinic.reviews.map((review) =>
      stripUndefined({
        '@type': 'Review',
        name: review.title,
        reviewBody: reviewDisplayText(review),
        datePublished: review.reviewDate,
        reviewRating: {
          '@type': 'Rating',
          ratingValue: review.rating,
          bestRating: 5,
          worstRating: 1,
        },
        publisher: review.sourcePlatform
          ? {
              '@type': 'Organization',
              name: formatSourceLabel(review.sourcePlatform),
            }
          : undefined,
      }),
    )
  }

  const items: object[] = [breadcrumb, stripUndefined(medicalBusiness)]

  if (faqs.length > 0) {
    items.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.detail ? `${faq.answer} ${faq.detail}` : faq.answer,
        },
      })),
    })
  }

  return items
}

function buildFallbackFaqs(clinic: ClinicDetail): ClinicFaq[] {
  const faqs: ClinicFaq[] = []

  const serviceNames = clinic.servicesOffered.map((s) => s.name)
  const brandNames = clinic.brandsOffered.map((b) => b.name)
  if (serviceNames.length > 0 || brandNames.length > 0) {
    const parts: string[] = []
    if (serviceNames.length > 0) {
      const highlights = serviceNames.slice(0, 4).join(', ')
      parts.push(
        `${clinic.clinicName} offers ${serviceNames.length} service${serviceNames.length === 1 ? '' : 's'} including ${highlights}.`,
      )
    }
    if (brandNames.length > 0) {
      parts.push(`Brands offered include ${brandNames.join(', ')}.`)
    }
    parts.push('See the full list in the treatments section on this page.')
    faqs.push({
      id: 'auto-treatments',
      question: `What treatments does ${clinic.clinicName} offer?`,
      answer: parts.join(' '),
    })
  }

  if (clinic.aggregateRating && clinic.aggregateRatingCount) {
    faqs.push({
      id: 'auto-rating',
      question: `How is ${clinic.clinicName} rated?`,
      answer: `${clinic.clinicName} has a ${clinic.aggregateRating.toFixed(1)} star rating based on ${clinic.aggregateRatingCount.toLocaleString()} patient reviews.`,
    })
  }

  faqs.push({
    id: 'auto-location',
    question: `Where is ${clinic.clinicName} located?`,
    answer: `${clinic.clinicName} is located at ${fullAddress(clinic)}.${clinic.hoursJson ? ' See the hours of operation on this page before you visit.' : ''}`,
  })

  return faqs
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

/* hoursToday / nextOpening / parseHoursRange / toMinutes / formatMinutes lived
   here until 2026-08-06. The quick-info bar was their only caller; the live
   open/closed logic now runs client-side in components/clinics/ClinicHoursBar,
   where it can read the visitor's own clock instead of the server's. */

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

function reviewDisplayText(review: ClinicDetail['reviews'][number]): string | undefined {
  if (review.publishStatus === 'hidden') return undefined
  if (review.publishStatus === 'full') return review.text || review.excerpt || undefined
  if (review.excerpt) return review.excerpt
  return review.text ? truncate(review.text, 200) : undefined
}

function renderStars(rating: number): string {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)))
  return `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}`
}

function formatReviewDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatSourceLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** Lowercase on purpose: this one reads mid-sentence in the meta description. */
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

/** Title Case for the hero chip (client request 2026-08-06). */
function clinicTypeChipLabel(type?: string): string {
  return formatClinicType(type)
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
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
