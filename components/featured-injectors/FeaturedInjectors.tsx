'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef } from 'react'
import type { FeaturedProvider } from '@/lib/home-queries'
import { licenseClaim } from '@/lib/license'
import { CarouselDots } from '@/components/ui/CarouselDots'

export function FeaturedInjectors({ providers }: { providers: FeaturedProvider[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  if (providers.length === 0) return null

  return (
    <section className="bg-surface section-pad">
      <div className="max-canvas">
        <div className="flex items-end justify-between gap-6 mb-10 md:mb-14 flex-wrap">
          <div className="max-w-[640px]">
            <h2 className="headline-display text-h2-m md:text-h2 text-ink-primary mb-2">Top picks.</h2>
            <p className="font-serif text-[20px] md:text-[24px] leading-[1.3] text-ink-secondary font-normal">Highly rated injectors, verified by our team.</p>
          </div>
          <Link href="/injectors" className="group inline-flex items-center gap-2 text-body-sm font-medium text-brand-accent hover:underline">
            See all featured
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:translate-x-0.5 transition"><polyline points="9 18 15 12 9 6" /></svg>
          </Link>
        </div>

        {/* Scroll container with right-edge fade hint on mobile */}
        <div className="relative">
          <div ref={scrollRef} className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 overflow-x-auto snap-x snap-mandatory hide-scrollbar -mx-5 md:mx-0 px-5 md:px-0 pb-2">
            {providers.map((p) => (
              <FeaturedCard key={p.id} p={p} />
            ))}
          </div>
          {/* Fade hint — mobile only */}
          <div className="pointer-events-none absolute -right-5 top-0 bottom-2 w-16 bg-gradient-to-l from-surface to-surface/0 md:hidden" aria-hidden />
        </div>

        <CarouselDots scrollRef={scrollRef} count={providers.length} />
      </div>
    </section>
  )
}

function FeaturedCard({ p }: { p: FeaturedProvider }) {
  const stars = Math.round(p.aggregateRating || 0)
  const visibleTreatments = p.treatments.slice(0, 3)
  const extraCount = p.treatments.length - 3

  return (
    <article className="group card-premium bg-surface-canvas border border-border rounded-2xl overflow-hidden flex-shrink-0 w-[80vw] max-w-[340px] md:w-auto snap-start">
      {/* Clinic cover photo */}
      <div className="relative h-[220px] md:h-[240px] bg-surface overflow-hidden">
        {p.clinic.photoUrl && (
          <Image src={p.clinic.photoUrl} alt={p.clinic.name} fill sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 320px" className="object-cover transition-transform duration-700 group-hover:scale-105" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-60" />
        <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-brand-accent text-surface-canvas text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-pill uppercase shadow-md">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" /></svg>
          Top pick
        </span>
      </div>

      <div className="p-6 md:p-7">
        {/* Injector avatar + name */}
        <div className="flex items-start gap-3 mb-4">
          <div className="relative w-16 h-16 rounded-pill overflow-hidden bg-surface flex-shrink-0 -mt-14 border-4 border-surface-canvas shadow-md transition-all duration-200 group-hover:ring-2 group-hover:ring-brand-accent group-hover:ring-offset-2">
            {p.profilePhotoUrl && <Image src={p.profilePhotoUrl} alt={p.fullName} fill sizes="64px" className="object-cover" />}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <div className="font-semibold text-body text-ink-primary leading-tight">{p.fullName}</div>
            <div className="text-caption text-ink-secondary mt-0.5 line-clamp-1">{p.title}</div>
          </div>
        </div>

        {/* License verified */}
        <div className="flex items-center gap-2 mb-3 text-caption text-ink-secondary">
          <span className="inline-flex w-4 h-4 rounded-pill bg-brand-accent-soft items-center justify-center flex-shrink-0">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
          </span>
          <span className="truncate">{licenseClaim(p.licenseVerificationUrl, p.licenseStatus)} &middot; {p.licenseStateCode} #{p.licenseNumber}{p.yearsExperience ? ` · ${p.yearsExperience} yrs` : ''}</span>
        </div>

        {/* Stars */}
        <div className="flex items-center gap-2 mb-4">
          <span className="star-row text-[14px]">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
          <span className="text-body-sm text-ink-secondary">{p.aggregateRating?.toFixed(1)} ({p.aggregateRatingCount})</span>
        </div>

        {/* Treatment chips with +N overflow */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {visibleTreatments.map((t) => (
            <span key={t} className="text-[11px] px-2.5 py-1 rounded-pill bg-brand-accent-soft text-brand-primary font-medium">{t}</span>
          ))}
          {extraCount > 0 && (
            <span className="text-[11px] px-2.5 py-1 rounded-pill bg-surface text-ink-tertiary font-medium border border-border">+{extraCount} more</span>
          )}
        </div>

        {/* Loyalty badges */}
        {p.loyaltyPrograms && p.loyaltyPrograms.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {(p.loyaltyPrograms as string[]).map((prog) => {
              const labels: Record<string, string> = { alle: 'Allē', aspire: 'Aspire', xperience: 'Xperience', other: 'Loyalty' }
              return (
                <span key={prog} className="text-[9px] px-2 py-0.5 rounded-pill bg-surface border border-border text-ink-tertiary font-semibold uppercase tracking-wide">
                  {labels[prog] ?? prog}
                </span>
              )
            })}
          </div>
        )}

        {/* Price + location */}
        <div className="flex items-center justify-between mb-5 pb-5 border-b border-border-subtle">
          <div className="text-body-sm"><span className="text-ink-secondary">from </span><span className="font-semibold text-ink-primary text-body">${p.startingPrice}</span></div>
          <div className="flex items-center gap-1 text-caption text-ink-tertiary">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            <span className="truncate">{p.clinic.neighborhood ? `${p.clinic.neighborhood}, ` : ''}{p.clinic.city}, {p.clinic.state}</span>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex gap-2">
          <Link href={`/injectors/${p.clinic.stateSlug}/${p.clinic.citySlug}/${p.slug}#book`} className="flex-1 bg-brand-primary text-surface-canvas rounded-pill py-2.5 text-body-sm font-medium text-center hover:opacity-90 transition">Book consult</Link>
          <Link href={`/injectors/${p.clinic.stateSlug}/${p.clinic.citySlug}/${p.slug}`} className="flex-1 border border-border rounded-pill py-2.5 text-body-sm font-medium text-center text-ink-primary hover:bg-surface hover:border-brand-accent transition">View profile</Link>
        </div>
      </div>
    </article>
  )
}
