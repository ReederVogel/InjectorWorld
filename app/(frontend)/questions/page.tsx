import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { getAnsweredQAs } from '@/lib/qa-queries'
import { AskQuestionForm } from '@/components/shared/AskQuestionForm'

export const revalidate = 300

export const metadata: Metadata = {
  title: { absolute: 'Injectable Q&A: Expert Answers to Your Questions | injector.world' },
  description:
    'Browse hundreds of expert answers to questions about Botox, fillers, and aesthetic injectables. Ask your own question and get a response from a verified provider.',
  alternates: { canonical: 'https://injector.world/questions' },
  openGraph: {
    title: 'Injectable Q&A: Expert Answers',
    description: 'Expert answers to questions about Botox, lip filler, cheek filler, and more.',
  },
}

export default async function QuestionsIndexPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
  let qas: Awaited<ReturnType<typeof getAnsweredQAs>> = []
  try { qas = await getAnsweredQAs({ limit: 40 }) } catch { /* DB unavailable at build time */ }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qas.slice(0, 10).map((q) => ({
      '@type': 'Question',
      name: q.questionTitle,
      acceptedAnswer: { '@type': 'Answer', text: q.answerText.slice(0, 300) },
    })),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Q&A', item: `${siteUrl}/questions` },
    ],
  }

  // Group by treatment tag for display
  const treatmentGroups = new Map<string, typeof qas>()
  for (const q of qas) {
    const tag = q.treatmentTag || 'General'
    if (!treatmentGroups.has(tag)) treatmentGroups.set(tag, [])
    treatmentGroups.get(tag)!.push(q)
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema).replace(/</g, '\\u003c') }} />

      <Header />

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <span className="text-ink-primary">Q&A</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-surface-warm pt-12 pb-10 md:pt-16 md:pb-12">
        <div className="max-canvas max-w-3xl">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-4 block">
            Expert Q&A
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-4">
            Your questions. Expert answers.
          </h1>
          <p className="font-serif text-lede-m md:text-lede text-ink-secondary max-w-2xl">
            Real questions from patients, answered by licensed providers and our medical advisory board.
          </p>
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-10 lg:gap-14 items-start">

            {/* Q&A list */}
            <div>
              {Array.from(treatmentGroups.entries()).map(([tag, items]) => (
                <div key={tag} className="mb-10">
                  <h2 className="font-serif text-h3 text-ink-primary mb-4">{tag}</h2>
                  <div className="space-y-4">
                    {items.map((q) => (
                      <Link
                        key={q.id}
                        href={`/questions/${q.slug}`}
                        className="block group rounded-xl border border-border bg-surface p-5 hover:border-brand-accent hover:bg-surface-warm transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-brand-accent-soft flex items-center justify-center">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2.5">
                              <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><circle cx="12" cy="17" r="0.5" fill="currentColor" />
                            </svg>
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-body text-ink-primary group-hover:text-brand-accent transition leading-snug mb-2">
                              {q.questionTitle}
                            </div>
                            <p className="text-body-sm text-ink-secondary line-clamp-2 leading-relaxed">
                              {q.answerText}
                            </p>
                            <div className="flex items-center gap-3 mt-3 text-caption text-ink-tertiary">
                              {q.answeredByProvider?.fullName || q.answeredByName ? (
                                <span>Answered by {q.answeredByProvider?.fullName || q.answeredByName}</span>
                              ) : null}
                              {q.date && (
                                <span>{new Date(q.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</span>
                              )}
                            </div>
                          </div>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-1 text-ink-tertiary group-hover:text-brand-accent transition">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              {qas.length === 0 && (
                <p className="text-body text-ink-secondary">No questions yet. Be the first to ask.</p>
              )}
            </div>

            {/* Sidebar: ask a question */}
            <div className="space-y-5 lg:sticky lg:top-24">
              <AskQuestionForm />

              <div className="rounded-xl border border-border-subtle bg-surface p-4 text-caption text-ink-tertiary leading-relaxed">
                Questions are answered by licensed providers and our editorial team. All answers are reviewed before publication. Information is educational and not medical advice.
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  )
}
