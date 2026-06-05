import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { getQABySlug, getAllAnsweredQASlugs, getAnsweredQAs } from '@/lib/qa-queries'
import { AskQuestionForm } from '@/components/shared/AskQuestionForm'

export const revalidate = 300

export async function generateStaticParams() {
  try {
    const slugs = await getAllAnsweredQASlugs()
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
  const qa = await getQABySlug(slug)
  if (!qa) return {}
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
  return {
    title: { absolute: `${qa.questionTitle} | injector.world Q&A` },
    description: qa.answerText.slice(0, 155),
    alternates: { canonical: `${siteUrl}/questions/${slug}` },
    openGraph: { title: qa.questionTitle, description: qa.answerText.slice(0, 155) },
  }
}

export default async function QADetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [qa, relatedQAs] = await Promise.all([
    getQABySlug(slug),
    getAnsweredQAs({ limit: 5 }),
  ])
  if (!qa) notFound()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  const qaSchema = {
    '@context': 'https://schema.org',
    '@type': 'QAPage',
    name: qa.questionTitle,
    description: qa.answerText.slice(0, 155),
    url: `${siteUrl}/questions/${slug}`,
    mainEntity: {
      '@type': 'Question',
      name: qa.questionTitle,
      text: qa.questionText ?? qa.questionTitle,
      dateCreated: qa.date,
      acceptedAnswer: {
        '@type': 'Answer',
        text: qa.answerText,
        dateCreated: qa.date,
        author: qa.answeredByProvider
          ? { '@type': 'Person', name: qa.answeredByProvider.fullName }
          : qa.answeredByName
          ? { '@type': 'Person', name: qa.answeredByName }
          : undefined,
      },
    },
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Q&A', item: `${siteUrl}/questions` },
      { '@type': 'ListItem', position: 3, name: qa.questionTitle },
    ],
  }

  const related = relatedQAs.filter((q) => q.id !== qa.id).slice(0, 4)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(qaSchema).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema).replace(/</g, '\\u003c') }} />

      <Header />

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <Link href="/questions" className="hover:text-ink-primary transition">Q&A</Link>
            <span>/</span>
            <span className="text-ink-primary truncate max-w-[200px] md:max-w-none">{qa.questionTitle}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-surface-warm pt-12 pb-8 md:pt-14 md:pb-10">
        <div className="max-canvas max-w-3xl">
          {qa.treatmentTag && (
            <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-4 block">
              {qa.treatmentTag}
            </span>
          )}
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">
            {qa.questionTitle}
          </h1>
          {qa.date && (
            <div className="text-caption text-ink-tertiary">
              {new Date(qa.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          )}
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10 lg:gap-14 items-start">

            {/* Main content */}
            <div>
              {/* Question */}
              {qa.questionText && (
                <div className="mb-8 p-5 rounded-xl bg-surface border-l-4 border-brand-accent-soft">
                  <p className="text-body text-ink-secondary leading-relaxed italic">{qa.questionText}</p>
                </div>
              )}

              {/* Answer */}
              <div className="rounded-2xl border border-border bg-surface p-6 md:p-8">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-full bg-brand-accent-soft flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-body-sm font-semibold text-ink-primary">
                      {qa.answeredByProvider?.fullName || qa.answeredByName || 'injector.world Editorial'}
                    </div>
                    <div className="text-caption text-brand-accent font-medium">Verified answer</div>
                  </div>
                </div>

                <div className="prose-guide text-body text-ink-secondary leading-relaxed whitespace-pre-line">
                  {qa.answerText}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="mt-6 rounded-xl border border-border-subtle bg-surface p-4 text-caption text-ink-tertiary leading-relaxed">
                This answer is for educational purposes and does not constitute medical advice. Consult a qualified provider before any treatment.
              </div>

              {/* Related questions */}
              {related.length > 0 && (
                <div className="mt-12">
                  <h2 className="font-serif text-h3 text-ink-primary mb-5">More questions</h2>
                  <div className="space-y-3">
                    {related.map((q) => (
                      <Link
                        key={q.id}
                        href={`/questions/${q.slug}`}
                        className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-surface hover:border-brand-accent hover:bg-surface-warm transition-all group"
                      >
                        <span className="text-body-sm font-medium text-ink-primary group-hover:text-brand-accent transition">{q.questionTitle}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-ink-tertiary group-hover:text-brand-accent transition">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                  <Link href="/questions" className="inline-flex items-center gap-1.5 mt-4 text-body-sm text-brand-accent font-medium hover:underline">
                    See all Q&A
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                  </Link>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-5 lg:sticky lg:top-24">
              {qa.answeredByProvider && (
                <div className="rounded-2xl border border-border bg-surface-warm p-5">
                  <div className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3">Answered by</div>
                  <Link href={`/injectors/${qa.answeredByProvider.slug}`} className="font-semibold text-body text-ink-primary hover:text-brand-accent transition">
                    {qa.answeredByProvider.fullName}
                  </Link>
                  <div className="mt-3">
                    <Link
                      href={`/injectors/${qa.answeredByProvider.slug}`}
                      className="flex w-full items-center justify-center gap-2 bg-brand-primary text-surface-canvas rounded-pill py-2.5 text-body-sm font-semibold hover:opacity-90 transition"
                    >
                      View profile
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                    </Link>
                  </div>
                </div>
              )}

              <AskQuestionForm compact treatmentTag={qa.treatmentTag} />
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  )
}
