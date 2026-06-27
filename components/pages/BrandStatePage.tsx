import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import type { BrandStateData } from '@/lib/brand-queries'

type Props = { data: BrandStateData; schema: object[] }

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-xl border border-border bg-surface overflow-hidden">
      <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none select-none hover:bg-surface-canvas transition">
        <span className="font-medium text-body text-ink-primary">{question}</span>
        <svg className="flex-shrink-0 w-5 h-5 text-ink-tertiary group-open:rotate-180 group-open:text-brand-accent transition-transform duration-200"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="px-5 pb-5 pt-3 border-t border-border-subtle text-body-sm text-ink-secondary leading-relaxed">{answer}</div>
    </details>
  )
}

export function BrandStatePage({ data, schema }: Props) {
  const { brand, state, cities, faqs, totalClinics } = data

  return (
    <>
      {schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />
      ))}

      <Header />

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary flex-wrap" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <Link href="/brands" className="hover:text-ink-primary transition">Brands</Link>
            <span>/</span>
            <Link href={`/brands/${brand.slug}`} className="hover:text-ink-primary transition">{brand.name}</Link>
            <span>/</span>
            <span className="text-ink-primary">{state.name}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-surface-canvas pt-10 pb-8 border-b border-border">
        <div className="max-canvas">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3 block">
            {brand.name} Directory
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">
            {brand.name} in {state.name}
          </h1>
          <p className="text-body-lg text-ink-secondary max-w-2xl">
            Find clinics carrying {brand.name} across {state.name}. All license-checked and patient-reviewed.
            {totalClinics > 0 && ` ${totalClinics.toLocaleString()} clinics found.`}
          </p>
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas space-y-14">

          {/* Cities */}
          {cities.length > 0 && (
            <div>
              <h2 className="font-serif text-h2 text-ink-primary mb-6">{brand.name} by city in {state.name}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {cities.map((c) => (
                  <Link
                    key={c.id}
                    href={`/brands/${brand.slug}/${state.slug}/${c.slug}`}
                    className="group flex items-center justify-between p-4 rounded-xl border border-border bg-surface hover:border-brand-accent hover:bg-surface-warm transition-all"
                  >
                    <div>
                      <div className="font-medium text-body-sm text-ink-primary group-hover:text-brand-accent transition">{c.name}</div>
                      {c.providerCount > 0 && <div className="text-caption text-ink-tertiary">{c.providerCount.toLocaleString()}+ clinics</div>}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-tertiary group-hover:text-brand-accent flex-shrink-0">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* FAQs */}
          {faqs.length > 0 && (
            <div>
              <h2 className="font-serif text-h2 text-ink-primary mb-5">Frequently asked questions</h2>
              <div className="space-y-2 max-w-3xl">
                {faqs.map((f) => <FaqItem key={f.id} question={f.question} answer={f.answer} />)}
              </div>
            </div>
          )}

          {/* Internal links */}
          <div className="flex flex-wrap gap-3">
            <Link href={`/brands/${brand.slug}`} className="flex items-center gap-1.5 text-body-sm text-brand-accent hover:underline">
              All {brand.name} clinics
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
            <Link href={`/${state.slug}`} className="flex items-center gap-1.5 text-body-sm text-brand-accent hover:underline">
              All clinics in {state.name}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </>
  )
}
