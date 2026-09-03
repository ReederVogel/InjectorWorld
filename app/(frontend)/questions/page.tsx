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
    'Browse hundreds of expert answers to questions about Botox, fillers, and aesthetic injectables. Ask your own question and get a response from a verified clinic.',
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

  /**
   * ItemList, not FAQPage.
   *
   * This emitted FAQPage carrying the first 10 answers in full. Each of those
   * questions also has its own /questions/[slug] page emitting QAPage for the
   * same text, and the questions are seeded from the `faqs` collection, which
   * renders them a third time inside the FAQPage blocks on the service, brand
   * and guide pages. Three markup blocks, one answer.
   *
   * An index is a list of links, so it gets the markup for a list of links and
   * the answer text lives on the one page that is actually about it. FAQPage
   * here would also have been the weakest of the three claims: Google wants
   * FAQPage on the page whose own content the FAQ is.
   */
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Injectable Q&A',
    itemListElement: qas.slice(0, 25).map((q, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: q.questionTitle,
      url: `${siteUrl}/questions/${q.slug}`,
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

  // Group by service tag for display
  const serviceGroups = new Map<string, typeof qas>()
  for (const q of qas) {
    const tag = q.serviceTag || 'General'
    if (!serviceGroups.has(tag)) serviceGroups.set(tag, [])
    serviceGroups.get(tag)!.push(q)
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
            Q&A
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-4">
            Questions about injectables
          </h1>
          {/*
            No claim about who writes the answers. This said "answered by
            licensed providers and our medical advisory board", which was not
            true of a single one: every answer here was seeded from the `faqs`
            collection, which is editorial copy. On a medical directory an
            unearned credential claim is the wrong thing to guess at.
          */}
          <p className="font-serif text-lede-m md:text-lede text-ink-secondary max-w-2xl">
            Common questions about treatments, brands and what to expect.
          </p>
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-10 lg:gap-14 items-start">

            {/* Q&A list */}
            <div>
              {Array.from(serviceGroups.entries()).map(([tag, items]) => (
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
                              {q.answeredByName ? (
                                <span>Answered by {q.answeredByName}</span>
                              ) : null}
                              {q.date && (
                                <span>{new Date(q.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</span>
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
            {/*
              The grey note that sat under this form is gone. It claimed answers
              come from "licensed clinics and our editorial team", which is the
              same unearned claim the hero was making. The form itself already
              says questions are moderated, so nothing useful was lost.
            */}
            <div className="space-y-5 lg:sticky lg:top-24">
              <AskQuestionForm />
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  )
}
