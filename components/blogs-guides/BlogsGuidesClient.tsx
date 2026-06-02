'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { GuideRow } from '@/lib/home-queries'

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'treatment-guide', label: 'Treatment Guides' },
  { id: 'article', label: 'Articles' },
  { id: 'expert-qa', label: 'Expert Q&A' },
  { id: 'cost-report', label: 'Cost Reports' },
] as const

export function BlogsGuidesClient({ guides }: { guides: GuideRow[] }) {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]['id']>('all')

  const filtered = useMemo(() => {
    if (activeTab === 'all') return guides
    return guides.filter((g) => g.category === activeTab)
  }, [activeTab, guides])

  return (
    <>
      <div className="flex items-center gap-2 mb-8 overflow-x-auto hide-scrollbar -mx-5 md:mx-0 px-5 md:px-0 pb-1">
        {tabs.map((t) => {
          const count = t.id === 'all' ? guides.length : guides.filter((g) => g.category === t.id).length
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-pill text-body-sm font-medium transition ${
                isActive
                  ? 'bg-brand-primary text-surface-canvas border border-brand-primary'
                  : 'bg-surface-canvas text-ink-primary border border-border hover:border-brand-accent'
              }`}
            >
              {t.label}
              <span className={`text-caption font-normal ${isActive ? 'text-surface-canvas/70' : 'text-ink-tertiary'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-ink-secondary text-body">No guides in this category yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {filtered.map((g, i) => (
            <GuideCard key={g.id} g={g} index={i} />
          ))}
        </div>
      )}

      <div className="text-center mt-10">
        <Link href="/guides" className="inline-flex items-center gap-2 text-body font-medium text-brand-accent hover:underline">
          See all guides
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
        </Link>
      </div>
    </>
  )
}

function categoryLabel(cat: string) {
  return ({ 'treatment-guide': 'Treatment Guide', 'article': 'Article', 'expert-qa': 'Expert Q&A', 'cost-report': 'Cost Report' } as Record<string,string>)[cat] ?? cat
}

function GuideCard({ g, index }: { g: GuideRow; index: number }) {
  const date = g.lastMedicallyReviewed ? new Date(g.lastMedicallyReviewed) : null
  return (
    <Link
      href={`/guides/${g.slug}`}
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
      className="group bg-surface-canvas border border-border rounded-2xl overflow-hidden block animate-fade-up transition hover:shadow-hover hover:-translate-y-1 duration-300"
    >
      <div className="relative h-[200px] bg-surface">
        {g.coverImageUrl && (
          <Image src={g.coverImageUrl} alt={g.title} fill sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
        )}
        <span className="absolute top-3 left-3 bg-surface-canvas text-ink-primary text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded-pill uppercase shadow-sm">{categoryLabel(g.category)}</span>
      </div>
      <div className="p-6">
        <h3 className="font-serif text-h3-m mb-3 text-ink-primary leading-tight line-clamp-2 group-hover:text-brand-accent transition">{g.title}</h3>
        <p className="text-body-sm text-ink-secondary leading-[1.55] mb-5 line-clamp-3">{g.lede}</p>

        {g.reviewer && (
          <div className="flex items-center gap-2 mb-3">
            <div className="relative w-7 h-7 rounded-pill overflow-hidden bg-surface flex-shrink-0">
              {g.reviewer.photoUrl && <Image src={g.reviewer.photoUrl} alt={g.reviewer.fullName} fill sizes="28px" className="object-cover" />}
            </div>
            <div className="text-caption text-ink-secondary truncate">Reviewed by <span className="font-medium text-ink-primary">{g.reviewer.fullName}</span></div>
          </div>
        )}

        <div className="flex items-center justify-between text-caption text-ink-tertiary border-t border-border-subtle pt-3">
          <span>{g.readTimeMin ? `${g.readTimeMin} min read` : ''}</span>
          <span>{date ? date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}</span>
        </div>
      </div>
    </Link>
  )
}
