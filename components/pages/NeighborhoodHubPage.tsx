import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { DirectoryProviderCard } from '@/components/shared/DirectoryProviderCard'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import type { NeighborhoodHubData } from '@/lib/location-queries'

type Props = { data: NeighborhoodHubData; schema: object[] }

export function NeighborhoodHubPage({ data, schema }: Props) {
  const { state, city, neighborhood, providers, clinics } = data
  const cityDisplay = city.name.replace(/\s+city$/i, '')

  return (
    <>
      {schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />
      ))}

      <Header />

      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary flex-wrap" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <Link href={`/${state.slug}`} className="hover:text-ink-primary transition">{state.name}</Link>
            <span>/</span>
            <Link href={`/${state.slug}/${city.slug}`} className="hover:text-ink-primary transition">{cityDisplay}</Link>
            <span>/</span>
            <span className="text-ink-primary">{neighborhood.name}</span>
          </nav>
        </div>
      </div>

      <section className="bg-[#0B1B34] text-white pt-16 pb-12">
        <div className="max-canvas">
          <p className="overline text-brand-accent mb-3 tracking-widest">{cityDisplay}, {state.name}</p>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight mb-4">
            Injectors near {neighborhood.name}
          </h1>
          <p className="text-lede-m md:text-lede text-white/70 max-w-[600px] font-serif">
            License-verified aesthetic providers and clinics serving {neighborhood.name} and the surrounding area.
          </p>
        </div>
      </section>

      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          {providers.length > 0 ? (
            <>
              <h2 className="font-serif text-h2 text-ink-primary mb-8">
                {providers.length} {providers.length === 1 ? 'injector' : 'injectors'} nearby
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                {providers.map((p) => (
                  <DirectoryProviderCard key={p.id} provider={p} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <p className="text-body text-ink-secondary mb-2">No verified providers listed in {neighborhood.name} yet.</p>
              <Link href={`/${state.slug}/${city.slug}`} className="text-brand-accent text-body-sm underline">
                Browse all of {cityDisplay}
              </Link>
            </div>
          )}
        </div>
      </section>

      {clinics.length > 0 && (
        <section className="section-pad bg-surface border-t border-border">
          <div className="max-canvas">
            <h2 className="font-serif text-h2 text-ink-primary mb-8">Clinics in {neighborhood.name}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {clinics.map((c) => (
                <DirectoryClinicCard key={c.id} c={c} />
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </>
  )
}
