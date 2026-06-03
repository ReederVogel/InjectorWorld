import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { getPayloadInstance } from '@/lib/payload-server'
import { bodyAreas, type BodyArea } from '@/lib/body-areas-data'

export const revalidate = 300

export async function generateStaticParams() {
  return bodyAreas.map((a) => ({ area: a.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ area: string }>
}): Promise<Metadata> {
  const { area } = await params
  const data = bodyAreas.find((a) => a.slug === area)
  if (!data) return {}
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
  return {
    title: { absolute: `${data.name} Treatments | injector.world` },
    description: `Learn about ${data.name.toLowerCase()} injectable treatments. ${data.tagline} Find a licensed aesthetic injector near you.`,
    alternates: { canonical: `${siteUrl}/treatments/${area}` },
    openGraph: { title: `${data.name} Treatments`, description: data.tagline },
  }
}

const BODY_AREA_COPY: Record<string, { intro: string; concerns: string[]; whatToExpect: string }> = {
  forehead: {
    intro: 'Forehead lines are among the most common first concerns for people considering injectables. Horizontal lines across the forehead form when the frontalis muscle repeatedly contracts as we raise our eyebrows. Neurotoxins like Botox and Dysport temporarily relax this muscle, smoothing the lines without freezing expression.',
    concerns: ['Deep horizontal lines at rest', 'Lines visible when raising brows', 'Heavy brow appearance'],
    whatToExpect: 'A standard forehead treatment takes under 15 minutes. Results appear within 4 to 7 days and last 3 to 4 months. The dose matters: too many units over-treats the frontalis and causes a heavy brow. A conservative approach preserving natural movement is the standard of care.',
  },
  brow: {
    intro: 'The brow position affects how rested or alert a face appears. Strategic Botox placement can lift the tail of the brow by 1 to 3mm, opening the eye and creating a more defined arch. This is sometimes called the "Botox brow lift."',
    concerns: ['Low or flat brow position', 'Hooded appearance at the outer brow', 'Asymmetric brow height'],
    whatToExpect: 'A brow lift with Botox uses a small number of units placed precisely at the outer brow depressors. Results last 3 to 4 months. The effect is subtle and natural when done well.',
  },
  'under-eye': {
    intro: 'The tear trough is the groove that runs from the inner corner of the eye down toward the cheek. As volume under the eye decreases with age, this groove deepens and creates a hollow that casts a shadow. Tear trough filler places hyaluronic acid beneath the skin to soften the shadow.',
    concerns: ['Dark circles caused by hollowing', 'Sunken under-eye appearance', 'Tired look regardless of sleep'],
    whatToExpect: 'Tear trough is one of the most technically demanding filler placements. It requires precise depth and a conservative volume. The skin under the eye is thin and vascular. Bruising is common and can last 5 to 10 days. Always confirm your injector has hyaluronidase available to dissolve the filler if needed.',
  },
  'crows-feet': {
    intro: "Crow's feet are the fine lines that radiate from the outer corners of the eyes when you smile or squint. They form as the orbicularis oculi muscle repeatedly contracts. A small amount of Botox or Dysport here softens the lines while preserving a natural squint.",
    concerns: ["Lines at outer eye when squinting", "Lines visible at rest (deeper creases)", "Uneven lines side to side"],
    whatToExpect: "Crow's feet treatment is typically 10 to 15 units per side. Results show in 4 to 7 days and last 3 months on average. Expression is preserved because the inner orbicularis remains active.",
  },
  cheeks: {
    intro: 'The mid-face loses volume gradually over time, which can make the face appear flatter or more tired. Cheek filler placed on the zygomatic arch (cheekbone) restores volume and creates a lift effect on the lower face. Biostimulators like Sculptra build collagen gradually for a more natural long-term result.',
    concerns: ['Flattened cheeks', 'Sagging lower face from mid-face volume loss', 'Desire for more defined cheekbones'],
    whatToExpect: 'Cheek filler requires deep placement on the periosteum (bone level). Results are immediate with filler and gradual (3 to 6 months) with biostimulators. Swelling in the first 48 hours is normal. Results from HA filler last 12 to 18 months.',
  },
  lips: {
    intro: 'Lip filler adds volume, definition, or hydration to the lips using hyaluronic acid. Results range from subtle hydration and softened vertical lines to visible volume enhancement. The goal is proportion and balance, not size.',
    concerns: ['Thin or flat lips', 'Undefined cupid\'s bow', 'Vertical lip lines', 'Asymmetry between upper and lower lip'],
    whatToExpect: 'Most lip treatments use 0.5 to 1 syringe. Swelling peaks at 24 to 48 hours and largely resolves in a week. Final results are visible at 2 weeks. HA lip filler lasts 6 to 9 months on average, sometimes shorter due to lip movement.',
  },
  chin: {
    intro: 'Chin filler can project the chin forward, add definition to a recessed jaw, or improve the side profile. Kybella (deoxycholic acid) permanently destroys fat cells under the chin for long-term reduction of submental fat.',
    concerns: ['Recessed or weak chin', 'Submental fat (double chin)', 'Side profile balance'],
    whatToExpect: 'Chin filler is a single-needle or cannula treatment taking under 20 minutes. Kybella requires multiple sessions (typically 2 to 4) with significant swelling and firmness for 2 to 4 weeks per session.',
  },
  jawline: {
    intro: 'Jawline filler adds definition and projection along the mandible. Masseter Botox reduces the width of the lower face by relaxing the masseter muscle, and also relieves jaw clenching and TMJ symptoms. These two treatments are often combined.',
    concerns: ['Undefined or soft jawline', 'Wide lower face due to masseter hypertrophy', 'TMJ pain and jaw clenching', 'Desire for a more angular profile'],
    whatToExpect: 'Jawline filler uses a cannula along the mandible. Results are immediate and last 12 to 18 months. Masseter Botox takes 4 to 6 weeks to thin the muscle noticeably; results last 4 to 6 months initially and longer with repeat treatments.',
  },
  neck: {
    intro: 'Neck bands (platysmal bands) can be softened with Botox along the vertical cords of the neck. Profhilo and skin boosters improve skin texture and hydration across the neck and decolletage.',
    concerns: ['Visible vertical neck bands', 'Crepey or loose neck skin', 'Necklace lines (horizontal creases)'],
    whatToExpect: 'Neck Botox for platysmal bands uses 25 to 50 units placed in a series of points along each cord. Results last 3 to 4 months. Skin booster treatments require 2 to 3 sessions and results build over 4 to 8 weeks.',
  },
  decolletage: {
    intro: 'The chest and decolletage are among the first areas to show sun damage and aging. Skin boosters (polynucleotides, hyaluronic acid microinjections) hydrate and remodel the skin. Microneedling stimulates collagen through controlled micro-injury.',
    concerns: ['Sun damage and uneven tone', 'Crepe skin on the chest', 'Horizontal chest lines from sleeping'],
    whatToExpect: 'Skin booster treatments require a series of 3 sessions, 4 weeks apart. Redness and small bumps for 24 to 48 hours after each session are normal. Microneedling requires 24 to 72 hours of social downtime per session.',
  },
}

export default async function BodyAreaPage({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params
  const areaData: BodyArea | undefined = bodyAreas.find((a) => a.slug === area)
  if (!areaData) notFound()

  const copy = BODY_AREA_COPY[area] ?? {
    intro: `Learn about injectable treatments for the ${areaData.name.toLowerCase()} area.`,
    concerns: [],
    whatToExpect: 'Consult a board-certified provider to understand the right approach for your anatomy and goals.',
  }

  // Fetch treatments relevant to this area
  const payload = await getPayloadInstance()
  const treatmentRes = await payload.find({
    collection: 'treatments',
    where: { bodyAreas: { contains: area } },
    limit: 8,
    depth: 0,
  })
  const treatments = treatmentRes.docs as any[]

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    name: `${areaData.name} Injectable Treatments`,
    description: copy.intro.slice(0, 155),
    url: `${siteUrl}/treatments/${area}`,
    specialty: 'Dermatology',
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Treatments', item: `${siteUrl}/treatments` },
      { '@type': 'ListItem', position: 3, name: areaData.name },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <Header />

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <span className="text-ink-primary">{areaData.name}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-surface-warm pt-12 pb-10 md:pt-16 md:pb-12">
        <div className="max-canvas max-w-4xl">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-4 block">
            Body Area Guide
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-4">
            {areaData.name} Treatments
          </h1>
          <p className="font-serif text-lede-m md:text-lede text-ink-secondary max-w-2xl">
            {areaData.tagline}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {areaData.treatments.split('·').map((t) => (
              <span key={t.trim()} className="px-3 py-1.5 rounded-pill bg-brand-accent-soft text-brand-accent text-body-sm font-medium">
                {t.trim()}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-10 lg:gap-14 items-start">

            {/* Left: editorial content */}
            <div className="space-y-10">

              {/* Intro */}
              <div>
                <h2 className="font-serif text-h2 text-ink-primary mb-4">About {areaData.name.toLowerCase()} treatments</h2>
                <p className="text-body-lg text-ink-secondary leading-relaxed">{copy.intro}</p>
              </div>

              {/* Common concerns */}
              {copy.concerns.length > 0 && (
                <div>
                  <h2 className="font-serif text-h2 text-ink-primary mb-4">Common concerns</h2>
                  <ul className="space-y-3">
                    {copy.concerns.map((c) => (
                      <li key={c} className="flex items-start gap-3 text-body text-ink-secondary">
                        <span className="w-5 h-5 rounded-full bg-brand-accent-soft flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Treatment options */}
              {treatments.length > 0 && (
                <div>
                  <h2 className="font-serif text-h2 text-ink-primary mb-5">Treatment options</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {treatments.map((t) => (
                      <Link
                        key={t.id}
                        href={`/${t.slug}`}
                        className="group p-5 rounded-xl border border-border bg-surface hover:border-brand-accent hover:bg-surface-warm transition-all"
                      >
                        <div className="font-semibold text-body text-ink-primary group-hover:text-brand-accent transition mb-1">
                          {t.name}
                        </div>
                        {t.tagline && (
                          <div className="text-body-sm text-ink-secondary mb-3">{t.tagline}</div>
                        )}
                        {t.avgPriceFromUsd && (
                          <div className="text-caption text-ink-tertiary">
                            Avg. ${t.avgPriceFromUsd.toLocaleString()} to ${t.avgPriceToUsd?.toLocaleString()}
                          </div>
                        )}
                        <div className="mt-3 text-caption text-brand-accent font-medium flex items-center gap-1">
                          See providers
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* What to expect */}
              <div>
                <h2 className="font-serif text-h2 text-ink-primary mb-4">What to expect</h2>
                <p className="text-body-lg text-ink-secondary leading-relaxed">{copy.whatToExpect}</p>
              </div>

              {/* Risks callout */}
              <div className="rounded-2xl border border-state-error/20 bg-state-error/5 p-6">
                <h3 className="font-serif text-h3 text-ink-primary mb-2">Important: risks and side effects</h3>
                <p className="text-body-sm text-ink-secondary leading-relaxed">
                  All injectable treatments carry risks including bruising, swelling, asymmetry, infection, and vascular complications. Serious complications are rare with a qualified provider but can occur. Consult a board-certified physician or licensed provider and disclose your full medical history before treatment.
                </p>
                <Link href="/how-we-verify" className="inline-flex items-center gap-1.5 mt-3 text-body-sm text-brand-accent font-medium hover:underline">
                  How we verify providers
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                </Link>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-5 lg:sticky lg:top-24">
              {/* Find a provider CTA */}
              <div className="rounded-2xl border border-border bg-surface-warm p-6">
                <div className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3">Find a provider</div>
                <h3 className="font-serif text-h3 text-ink-primary mb-2 leading-snug">
                  Find a verified {areaData.name.toLowerCase()} injector near you
                </h3>
                <p className="text-body-sm text-ink-secondary mb-4">
                  Every provider is license-verified against the state medical board.
                </p>
                {treatments.length > 0 && (
                  <Link
                    href={`/${treatments[0].slug}/new-york-ny`}
                    className="flex w-full items-center justify-center gap-2 bg-brand-primary text-white rounded-pill py-3 text-body-sm font-semibold hover:opacity-90 transition"
                  >
                    Browse providers in NYC
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                  </Link>
                )}
              </div>

              {/* Trust */}
              <div className="rounded-xl border border-border-subtle bg-surface p-4 text-caption text-ink-tertiary leading-relaxed">
                Information here is editorial and not medical advice. Consult a qualified provider before any treatment.
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  )
}
