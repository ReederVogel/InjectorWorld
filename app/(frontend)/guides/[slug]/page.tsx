import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import {
  getGuideBySlug,
  getGuideFaqs,
  getAllGuideSlugs,
  type FaqItem,
} from '@/lib/guide-queries'
import { RenderLexical } from '@/lib/render-lexical'

export const revalidate = 300

export async function generateStaticParams() {
  try {
    const slugs = await getAllGuideSlugs()
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
  const guide = await getGuideBySlug(slug)
  if (!guide) return {}

  const title = guide.meta?.title || `${guide.title} | injector.world`
  const description = guide.meta?.description || guide.excerpt || guide.lede
  const imageUrl = guide.meta?.image?.url || guide.coverImageUrl
  const url = `https://injector.world/guides/${guide.slug}`

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      images: imageUrl ? [imageUrl] : [],
      publishedTime: guide.publishedAt,
      modifiedTime: guide.lastMedicallyReviewed || guide.publishedAt,
      authors: [guide.author.fullName],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrl ? [imageUrl] : [],
    },
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  'treatment-guide': 'Treatment Guide',
  article: 'Article',
  'expert-qa': 'Expert Q&A',
  'cost-report': 'Cost Report',
}

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const guide = await getGuideBySlug(slug)
  if (!guide) notFound()

  let faqs: FaqItem[] = guide.faqs
  if (faqs.length === 0 && guide.relatedTreatment) {
    faqs = await getGuideFaqs(guide.relatedTreatment.name)
  }

  const reviewedFormatted = guide.lastMedicallyReviewed
    ? new Date(guide.lastMedicallyReviewed).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  const categoryLabel = CATEGORY_LABELS[guide.category] || 'Guide'
  const siteUrl = 'https://injector.world'

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': ['MedicalWebPage', 'Article'],
    headline: guide.title,
    description: guide.excerpt || guide.lede,
    ...(guide.coverImageUrl ? { image: guide.coverImageUrl } : {}),
    url: `${siteUrl}/guides/${guide.slug}`,
    ...(guide.publishedAt ? { datePublished: guide.publishedAt } : {}),
    ...(guide.lastMedicallyReviewed || guide.publishedAt
      ? { dateModified: guide.lastMedicallyReviewed || guide.publishedAt }
      : {}),
    author: {
      '@type': 'Person',
      name: guide.author.fullName,
      ...(guide.author.linkedinUrl ? { url: guide.author.linkedinUrl } : {}),
    },
    publisher: {
      '@type': 'Organization',
      name: 'injector.world',
      url: siteUrl,
    },
    ...(guide.medicalReviewer
      ? {
          reviewedBy: {
            '@type': 'Person',
            name: guide.medicalReviewer.fullName,
            honorificSuffix: guide.medicalReviewer.credentials,
          },
        }
      : {}),
    ...(guide.relatedTreatment ? { specialty: 'Dermatology' } : {}),
  }

  const faqSchema =
    faqs.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }
      : null

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: `${siteUrl}/guides` },
      { '@type': 'ListItem', position: 3, name: guide.title },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <Header />

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav
            className="flex items-center gap-2 text-caption text-ink-tertiary"
            aria-label="Breadcrumb"
          >
            <Link href="/" className="hover:text-ink-primary transition">
              Home
            </Link>
            <span>/</span>
            <Link href="/guides" className="hover:text-ink-primary transition">
              Guides
            </Link>
            <span>/</span>
            <span className="text-ink-primary truncate max-w-[200px] md:max-w-none">
              {guide.title}
            </span>
          </nav>
        </div>
      </div>

      {/* Article hero */}
      <section className="bg-surface-warm pt-12 pb-10 md:pt-16 md:pb-12">
        <div className="max-canvas">
          <div className="max-w-3xl mx-auto text-center">
            <span className="inline-block text-overline uppercase tracking-widest font-semibold text-brand-accent mb-4">
              {categoryLabel}
            </span>

            <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-5 text-balance">
              {guide.title}
            </h1>

            <p className="font-serif text-lede-m md:text-lede text-ink-secondary leading-relaxed mb-8 text-balance">
              {guide.lede}
            </p>

            {/* Byline + meta strip */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4 border-t border-border-subtle pt-6">
              {/* Author */}
              <div className="flex items-center gap-2.5 text-left">
                {guide.author.photoUrl ? (
                  <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-border">
                    <Image
                      src={guide.author.photoUrl}
                      alt={guide.author.fullName}
                      fill
                      sizes="36px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center flex-shrink-0">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-ink-tertiary"
                    >
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                )}
                <div>
                  <div className="text-body-sm font-medium text-ink-primary">
                    {guide.author.fullName}
                  </div>
                  {guide.author.role && (
                    <div className="text-caption text-ink-tertiary">{guide.author.role}</div>
                  )}
                </div>
              </div>

              {/* Medical reviewer */}
              {guide.medicalReviewer && (
                <div className="flex items-center gap-2.5 text-left">
                  {guide.medicalReviewer.photoUrl ? (
                    <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border-2 border-brand-accent">
                      <Image
                        src={guide.medicalReviewer.photoUrl}
                        alt={guide.medicalReviewer.fullName}
                        fill
                        sizes="36px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-brand-accent-soft border-2 border-brand-accent flex items-center justify-center flex-shrink-0">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="rgb(var(--brand-accent))"
                        strokeWidth="2"
                      >
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                      </svg>
                    </div>
                  )}
                  <div>
                    <div className="text-body-sm font-medium text-ink-primary">
                      {guide.medicalReviewer.fullName}, {guide.medicalReviewer.credentials}
                    </div>
                    <div className="text-caption text-brand-accent font-medium">
                      Medically reviewed
                    </div>
                  </div>
                </div>
              )}

              {/* Date + read time */}
              <div className="flex items-center gap-4 text-caption text-ink-tertiary">
                {reviewedFormatted && (
                  <span>
                    <span className="font-medium text-ink-secondary">Last reviewed</span>{' '}
                    {reviewedFormatted}
                  </span>
                )}
                {guide.readTimeMin && <span>{guide.readTimeMin} min read</span>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cover image */}
      {guide.coverImageUrl && (
        <div className="bg-surface-warm pb-10 md:pb-12">
          <div className="max-canvas">
            <div className="max-w-4xl mx-auto">
              <div className="relative w-full aspect-[16/7] rounded-xl overflow-hidden shadow-md">
                <Image
                  src={guide.coverImageUrl}
                  alt={guide.title}
                  fill
                  sizes="(min-width: 1024px) 900px, 100vw"
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content + sidebar */}
      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-10 lg:gap-14 items-start">

            {/* Left: article body + FAQs + reviewer card */}
            <div>
              {guide.body ? (
                <RenderLexical content={guide.body} />
              ) : (
                <div className="prose-guide">
                  <p>
                    This guide is being expanded by our editorial team. The full article will be
                    available soon. In the meantime, the FAQ section below covers the most
                    common questions.
                  </p>
                </div>
              )}

              {/* FAQ accordion */}
              {faqs.length > 0 && (
                <div className="mt-12">
                  <h2 className="font-serif text-h3 text-ink-primary mb-6">
                    Frequently asked questions
                  </h2>
                  <div className="space-y-2">
                    {faqs.map((faq) => (
                      <FaqAccordionItem
                        key={faq.id}
                        question={faq.question}
                        answer={faq.answer}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Sources count */}
              {guide.sourcesCount && guide.sourcesCount > 0 && (
                <div className="mt-10 flex items-start gap-3 p-4 rounded-lg border border-border bg-surface text-body-sm text-ink-secondary">
                  <svg
                    className="flex-shrink-0 mt-0.5"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgb(var(--brand-accent))"
                    strokeWidth="2"
                  >
                    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
                  </svg>
                  <span>
                    This guide cites{' '}
                    <span className="font-medium text-ink-primary">
                      {guide.sourcesCount} sources
                    </span>
                    . Our editorial team and medical reviewers verify source quality before
                    publication.{' '}
                    <Link href="/editorial-standards" className="text-brand-accent hover:underline">
                      Editorial standards
                    </Link>
                  </span>
                </div>
              )}

              {/* Medical reviewer credentials card */}
              {guide.medicalReviewer && (
                <div className="mt-10 rounded-2xl border border-border bg-surface p-6">
                  <div className="flex items-start gap-4">
                    {guide.medicalReviewer.photoUrl && (
                      <div className="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0 border-2 border-brand-accent">
                        <Image
                          src={guide.medicalReviewer.photoUrl}
                          alt={guide.medicalReviewer.fullName}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-caption text-brand-accent font-semibold uppercase tracking-wider mb-1">
                        Medically reviewed by
                      </div>
                      <div className="font-semibold text-body text-ink-primary">
                        {guide.medicalReviewer.fullName}, {guide.medicalReviewer.credentials}
                      </div>
                      {guide.medicalReviewer.title && (
                        <div className="text-body-sm text-ink-secondary">
                          {guide.medicalReviewer.title}
                        </div>
                      )}
                      {guide.medicalReviewer.boardCertifications &&
                        guide.medicalReviewer.boardCertifications.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {guide.medicalReviewer.boardCertifications.map((cert) => (
                              <span
                                key={cert}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-pill bg-brand-accent-soft text-brand-accent"
                              >
                                <svg
                                  width="9"
                                  height="9"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                {cert}
                              </span>
                            ))}
                          </div>
                        )}
                      {reviewedFormatted && (
                        <div className="text-caption text-ink-tertiary mt-2">
                          Last reviewed {reviewedFormatted}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: sidebar */}
            <div className="space-y-5 lg:sticky lg:top-24">
              {/* Find provider CTA */}
              {guide.relatedTreatment && (
                <div className="rounded-2xl border border-border bg-surface-warm p-6">
                  <div className="flex items-center gap-1.5 mb-3">
                    <svg
                      className="text-brand-accent"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent">
                      Find a provider
                    </span>
                  </div>
                  <h3 className="font-serif text-h3 text-ink-primary mb-2 leading-snug">
                    Find a verified {guide.relatedTreatment.name} injector near you
                  </h3>
                  {guide.relatedTreatment.tagline && (
                    <p className="text-body-sm text-ink-secondary mb-4">
                      {guide.relatedTreatment.tagline}
                    </p>
                  )}
                  <Link
                    href={`/${guide.relatedTreatment.slug}`}
                    className="flex w-full items-center justify-center gap-2 bg-brand-primary text-white rounded-pill py-3 text-body-sm font-semibold hover:opacity-90 transition"
                  >
                    Browse providers
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                </div>
              )}

              {/* About this guide */}
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
                <h3 className="text-h4 text-ink-primary">About this guide</h3>
                {(
                  [
                    guide.medicalReviewer
                      ? `Medically reviewed by ${guide.medicalReviewer.fullName}`
                      : 'Written by the injector.world editorial team',
                    'Based on peer-reviewed research and clinical sources',
                    'Zero paid placements or sponsored content',
                    guide.sourcesCount ? `${guide.sourcesCount} sources cited` : null,
                  ] as (string | null)[]
                )
                  .filter(Boolean)
                  .map((item) => (
                    <div
                      key={item as string}
                      className="flex items-start gap-2.5 text-body-sm text-ink-secondary"
                    >
                      <svg
                        className="flex-shrink-0 mt-0.5"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="rgb(var(--brand-accent))"
                        strokeWidth="2.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {item}
                    </div>
                  ))}
                <Link
                  href="/editorial-standards"
                  className="block text-caption text-brand-accent hover:underline pt-1"
                >
                  Our editorial standards
                </Link>
              </div>

              {/* Disclaimer */}
              <div className="rounded-xl border border-border-subtle bg-surface p-4 text-caption text-ink-tertiary leading-relaxed">
                Information here is editorial and not medical advice. Consult a qualified
                provider before any treatment.
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}

function FaqAccordionItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-xl border border-border bg-surface overflow-hidden">
      <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none select-none hover:bg-surface-canvas transition">
        <span className="font-medium text-body text-ink-primary pr-2">{question}</span>
        <svg
          className="flex-shrink-0 w-5 h-5 text-ink-tertiary group-open:rotate-180 group-open:text-brand-accent transition-transform duration-200"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="px-5 pb-5 pt-3 border-t border-border-subtle text-body-sm text-ink-secondary leading-relaxed">
        {answer}
      </div>
    </details>
  )
}
