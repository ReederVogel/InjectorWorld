'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { GuideCard } from '@/lib/guide-queries'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Treatment Guides', value: 'treatment-guide' },
  { label: 'Articles', value: 'article' },
  { label: 'Expert Q&A', value: 'expert-qa' },
  { label: 'Cost Reports', value: 'cost-report' },
]

function categoryLabel(cat: string) {
  return TABS.find((t) => t.value === cat)?.label ?? cat
}

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function GuideCardUI({ guide }: { guide: GuideCard }) {
  return (
    <Link
      href={`/guides/${guide.slug}`}
      className="group flex flex-col rounded-2xl border border-border bg-surface overflow-hidden hover:shadow-hover transition-shadow"
    >
      {guide.coverImageUrl && (
        <div className="relative w-full aspect-[16/9] overflow-hidden bg-surface-warm">
          <Image
            src={guide.coverImageUrl}
            alt={guide.title}
            fill
            sizes="(min-width:1024px) 350px, (min-width:640px) 50vw, 100vw"
            className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        </div>
      )}
      <div className="flex-1 p-5 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-pill bg-brand-accent-soft text-brand-accent">
            {categoryLabel(guide.category)}
          </span>
          {guide.readTimeMin && (
            <span className="text-caption text-ink-tertiary">{guide.readTimeMin} min read</span>
          )}
        </div>
        <h2 className="font-serif text-h3 font-medium leading-snug tracking-tight text-ink-primary mb-2 group-hover:text-brand-accent transition-colors line-clamp-3">
          {guide.title}
        </h2>
        <p className="text-body-sm text-ink-secondary leading-relaxed line-clamp-2 flex-1">
          {guide.lede}
        </p>
        <div className="mt-4 pt-4 border-t border-border-subtle flex items-center gap-3 flex-wrap">
          {guide.author.photoUrl && (
            <div className="relative w-7 h-7 rounded-full overflow-hidden bg-surface-warm flex-shrink-0">
              <Image src={guide.author.photoUrl} alt={guide.author.fullName} fill sizes="28px" className="object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="text-caption text-ink-secondary font-medium">{guide.author.fullName}</span>
            {guide.medicalReviewer && (
              <span className="block text-[11px] text-ink-tertiary">
                Reviewed by {guide.medicalReviewer.fullName}, {guide.medicalReviewer.credentials}
              </span>
            )}
          </div>
          {guide.lastMedicallyReviewed && (
            <span className="flex-shrink-0 text-[11px] text-ink-tertiary">
              {formatDate(guide.lastMedicallyReviewed)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

export function GuidesGrid({ guides }: { guides: GuideCard[] }) {
  const [activeTab, setActiveTab] = useState('all')

  const filtered = useMemo(
    () => (activeTab === 'all' ? guides : guides.filter((g) => g.category === activeTab)),
    [guides, activeTab],
  )

  const countFor = (cat: string) =>
    cat === 'all' ? guides.length : guides.filter((g) => g.category === cat).length

  return (
    <>
      {/* Sticky filter tabs */}
      <div className="sticky top-[65px] z-20 bg-surface-canvas border-b border-border">
        <div className="max-canvas">
          <div className="flex items-center gap-1.5 overflow-x-auto py-3 scrollbar-none">
            {TABS.map((tab) => {
              const count = countFor(tab.value)
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex-shrink-0 px-4 py-2 rounded-pill text-body-sm font-medium transition ${
                    activeTab === tab.value
                      ? 'bg-brand-primary text-surface-canvas'
                      : 'bg-surface text-ink-secondary hover:bg-surface-warm hover:text-ink-primary border border-border'
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={`ml-1.5 text-[11px] ${
                        activeTab === tab.value ? 'text-surface-canvas/70' : 'text-ink-tertiary'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Guide grid */}
      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-body text-ink-secondary">No guides in this category yet.</p>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className="mt-3 text-brand-accent text-body-sm hover:underline"
              >
                View all guides
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((guide) => (
                <GuideCardUI key={guide.id} guide={guide} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
